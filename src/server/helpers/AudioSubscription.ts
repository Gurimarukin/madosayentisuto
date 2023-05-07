import type {
  AudioPlayer,
  AudioPlayerState,
  VoiceConnection,
  VoiceConnectionState,
} from '@discordjs/voice'
import { AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice'
import type { BaseMessageOptions, Guild, Message, User } from 'discord.js'
import { ThreadAutoArchiveDuration } from 'discord.js'
import type { io } from 'fp-ts'
import { apply } from 'fp-ts'
import { flow, identity, pipe } from 'fp-ts/function'

import type { LoggerType } from '../../shared/models/LoggerType'
import { Store } from '../../shared/models/Store'
import type { Track } from '../../shared/models/audio/music/Track'
import { ServerToClientEvent } from '../../shared/models/event/ServerToClientEvent'
import { AsyncQueue } from '../../shared/models/rx/AsyncQueue'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { OldAndNewState } from '../models/OldAndNewState'
import type { AudioStateConnected, AudioStateConnecting } from '../models/audio/AudioState'
import { AudioState, AudioStateNotDisconnected } from '../models/audio/AudioState'
import {
  AudioStateValue,
  AudioStateValueElevator,
  AudioStateValueMusic,
} from '../models/audio/AudioStateValue'
import { PlayerMessageDeps } from '../models/audio/PlayerMessageDeps'
import { AudioEvent } from '../models/event/AudioEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildAudioChannel, GuildSendableChannel, NamedChannel } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
import { getOnError } from '../utils/getOnError'
import { DiscordConnector } from './DiscordConnector'
import { ResourcesHelper } from './ResourcesHelper'
import type { YtDlp } from './YtDlp'
import { PlayerEventMessage } from './messages/PlayerEventMessage'
import { PlayerStateMessage } from './messages/PlayerStateMessage'

// TODO: constants
const threadName = 'D-Jean Plank'

/* eslint-disable functional/no-return-void */
type VoiceConnectionEvents = {
  error: (error: Error) => void
} & {
  [S in VoiceConnectionStatus]: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { status: S },
  ) => void
}

type AudioPlayerEvents = {
  error: (error: Error) => void
} & {
  [S in AudioPlayerStatus]: (
    oldState: AudioPlayerState,
    newState: AudioPlayerState & {
      status: S
    },
  ) => void
}
/* eslint-enable functional/no-return-void */

export type AudioSubscription = {
  getAudioState: io.IO<AudioState>
  disconnect: Future<NotUsed>
  queueTracks: (
    author: User,
    audioChannel: GuildAudioChannel,
    messageChannel: GuildSendableChannel,
    tracks: NonEmptyArray<Track>,
  ) => IO<NotUsed>
  playNextTrack: (author: User) => IO<NotUsed>
  playPauseTrack: IO<NotUsed>
  startElevator: (
    author: User,
    audioChannel: GuildAudioChannel,
    messageChannel: GuildSendableChannel,
  ) => IO<NotUsed>
  stringify: () => string
}

const of = (
  Logger: LoggerGetter,
  resourcesHelper: ResourcesHelper,
  ytDlp: YtDlp,
  serverToClientEventSubject: TSubject<ServerToClientEvent>,
  guild: Guild,
): IO<AudioSubscription> => {
  const logger = Logger(`AudioSubscription-${guild.name}#${guild.id}`)

  const audioEvents = PubSub<AudioEvent>()
  const subAudioEvents = PubSubUtils.subscribeWithRefinement(
    getOnError(logger),
    audioEvents.observable,
  )
  const subscribeAudioEvents = apply.sequenceT(IO.ApplyPar)(subAudioEvents(lifecycleObserver()))

  const audioState = Store<AudioState>(AudioState.disconnected)

  const stateReducers = AsyncQueue<NotUsed>(getOnError(logger))

  return pipe(
    subscribeAudioEvents,
    IO.map(
      (): AudioSubscription => ({
        getAudioState: audioState.get,
        disconnect: pipe(
          audioState.get,
          Future.fromIO,
          Future.chain(state =>
            AudioState.isDisconnected(state)
              ? Future.notUsed
              : voiceConnectionDestroy(state.voiceConnection),
          ),
        ),

        queueTracks,
        playNextTrack,
        playPauseTrack: getPlayPauseTrack(),
        startElevator,

        stringify,
      }),
    ),
  )

  function queueTracks(
    author: User,
    audioChannel: GuildAudioChannel,
    messageChannel: GuildSendableChannel,
    tracks: NonEmptyArray<Track>,
  ): IO<NotUsed> {
    const queueTracksValueMusic = AudioStateValueMusic.queueTracks(
      tracks,
      PlayerEventMessage.tracksAdded(author, tracks),
    )

    return queueStateReducer(state => {
      if (AudioState.isDisconnected(state)) {
        return getConnecting(
          audioChannel,
          pipe(
            AudioStateValue.music({
              currentTrack: Maybe.none,
              queue: List.empty,
              isPaused: false,
              messageChannel,
              message: Maybe.none,
              pendingEvents: List.empty,
            }),
            queueTracksValueMusic,
          ),
        )
      }

      return pipe(
        state.value,
        AudioStateValue.fold({
          onMusic: flow(
            state.channel.id === audioChannel.id ? queueTracksValueMusic : identity,
            Future.successful,
            Future.map(value => pipe(state, AudioStateNotDisconnected.setValue()(value))),
          ),

          onElevator: ({ message, pendingEvents }) => {
            const futureValue = pipe(
              AudioStateValue.music({
                currentTrack: Maybe.none,
                queue: List.empty,
                isPaused: false,
                messageChannel,
                message,
                pendingEvents,
              }),
              queueTracksValueMusic,
              Future.successful,
            )

            switch (state.type) {
              case 'Connecting':
                return connecting(
                  audioChannel,
                  futureValue,
                  state.channel.id === audioChannel.id
                    ? IO.right(state.voiceConnection)
                    : joinVoiceChannel(audioChannel),
                  IO.right(state.audioPlayer),
                )

              case 'Connected':
                if (state.channel.id === audioChannel.id) {
                  return pipe(
                    futureValue,
                    Future.map(value =>
                      AudioState.connected(
                        audioChannel,
                        value,
                        state.voiceConnection,
                        state.audioPlayer,
                        state.subscription,
                      ),
                    ),
                    Future.chain(playMusicFirstTrackFromQueue),
                  )
                }

                return connecting(
                  audioChannel,
                  futureValue,
                  pipe(
                    DiscordConnector.audioPlayerPause(state.audioPlayer),
                    IO.chain(() => joinVoiceChannel(audioChannel)),
                  ),
                  IO.right(state.audioPlayer),
                )
            }
          },
        }),
      )
    })
  }

  function playNextTrack(author: User): IO<NotUsed> {
    return queueStateReducer(state => {
      switch (state.type) {
        case 'Disconnected':
        case 'Connecting':
          return Future.successful(state)

        case 'Connected':
          return pipe(
            state,
            AudioStateNotDisconnected.foldValue<'AudioStateConnected'>()({
              onMusic: musicState =>
                List.isEmpty(musicState.value.queue)
                  ? pipe(
                      voiceConnectionDestroy(musicState.voiceConnection),
                      Future.map(() => musicState),
                    )
                  : pipe(
                      musicState,
                      AudioStateNotDisconnected.modifyValue<'AudioStateConnected'>()(
                        AudioStateValue.appendPendingEvent(
                          PlayerEventMessage.trackSkipped(author, musicState.value),
                        ),
                      ),
                      playMusicFirstTrackFromQueue,
                    ),

              onElevator: elevatorState =>
                pipe(
                  elevatorState,
                  AudioStateNotDisconnected.modifyValue<'AudioStateConnected'>()(
                    AudioStateValue.appendPendingEvent(
                      PlayerEventMessage.elevatorSkipped(author, elevatorState.value),
                    ),
                  ),
                  playElevatorFile,
                  Future.fromIOEither,
                ),
            }),
          )
      }
    })
  }

  function getPlayPauseTrack(): IO<NotUsed> {
    return queueStateReducer(state => {
      switch (state.type) {
        case 'Disconnected':
        case 'Connecting':
          return Future.successful(state)

        case 'Connected':
          return pipe(
            state,
            state.value.isPaused
              ? playPauseTrackCommon(DiscordConnector.audioPlayerUnpause, false)
              : playPauseTrackCommon(DiscordConnector.audioPlayerPause, true),
            Future.fromIOEither,
          )
      }
    })
  }

  function startElevator(
    author: User,
    audioChannel: GuildAudioChannel,
    messageChannel: GuildSendableChannel,
  ): IO<NotUsed> {
    return queueStateReducer(state => {
      switch (state.type) {
        case 'Disconnected':
          return pipe(
            resourcesHelper.randomElevatorPlaylist,
            Future.fromIO,
            Future.chain(playlist =>
              getConnecting(
                audioChannel,
                AudioStateValue.elevator({
                  playlist,
                  isPaused: false,
                  messageChannel,
                  message: Maybe.none,
                  pendingEvents: List.of(PlayerEventMessage.elevatorStarted(author)),
                }),
              ),
            ),
          )

        case 'Connecting':
        case 'Connected':
          return Future.successful(state)
      }
    })
  }

  /**
   * Lifecycle
   */

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function lifecycleObserver() {
    return ObserverWithRefinement.fromNext(
      AudioEvent,
      'ConnectionReady',
      'ConnectionDisconnected',
      'ConnectionDestroyed',
      'PlayerIdle',
    )(event =>
      Future.fromIOEither(
        queueStateReducer(state => {
          switch (event.type) {
            case 'ConnectionReady':
              return onConnectionReady(state)

            case 'ConnectionDisconnected':
              // When bot is actually moving from a channel to another.
              if (AudioState.isConnecting(state)) return Future.successful(state)

              return onConnectionDestroyed(state)

            case 'ConnectionDestroyed':
              return onConnectionDestroyed(state)

            case 'PlayerIdle':
              return onPlayerIdle(state)
          }
        }),
      ),
    )
  }

  function onConnectionReady(state: AudioState): Future<AudioState> {
    switch (state.type) {
      case 'Disconnected':
        return pipe(
          logger.warn(`Inconsistent state: onConnectionReady while state was ${state.type}`),
          Future.fromIOEither,
          Future.map(() => state),
        )

      case 'Connected':
        return Future.successful(state)

      case 'Connecting':
        return pipe(
          state,
          AudioStateNotDisconnected.foldValue<'AudioStateConnecting'>()({
            onMusic: musicState =>
              List.isEmpty(musicState.value.queue)
                ? pipe(
                    voiceConnectionDestroy(musicState.voiceConnection),
                    Future.map(() => musicState),
                  )
                : onConnectionReadyConnecting(musicState, playMusicFirstTrackFromQueue),

            onElevator: elevatorState =>
              onConnectionReadyConnecting(
                elevatorState,
                flow(playElevatorFile, Future.fromIOEither),
              ),
          }),
        )
    }
  }

  function onConnectionReadyConnecting<A extends AudioStateValue>(
    state: AudioStateConnecting<A>,
    onConnected: (connected: AudioStateConnected<A>) => Future<AudioStateConnected<A>>,
  ): Future<AudioStateConnected<A>> {
    return pipe(
      DiscordConnector.voiceConnectionSubscribe(state.voiceConnection, state.audioPlayer),
      Future.fromIOEither,
      Future.chain(subscription => {
        const newState = AudioState.connected(
          state.channel,
          state.value,
          state.voiceConnection,
          state.audioPlayer,
          subscription,
        )
        if (Maybe.isNone(subscription)) {
          return pipe(
            logger.error('Subscription failed'),
            Future.fromIOEither,
            Future.map(() => newState),
          )
        }
        return onConnected(newState)
      }),
    )
  }

  function onConnectionDestroyed(state: AudioState): Future<AudioState> {
    if (AudioState.isDisconnected(state)) return Future.successful(state)

    const log = (chan?: NamedChannel): LoggerType => LogUtils.pretty(logger, guild, null, chan)
    const orElse = Future.orElseIOEitherK(e => logger.warn(e))

    const maybeMessage = futureMaybe.fromOption(state.value.message)

    const audioPlayerStop = pipe(
      DiscordConnector.audioPlayerStop(state.audioPlayer),
      Future.fromIOEither,
      Future.map(toNotUsed),
      orElse,
    )

    const threadDelete = pipe(
      maybeMessage,
      futureMaybe.chainNullableK(message => message.thread),
      futureMaybe.chainTaskEitherK(thread =>
        pipe(
          DiscordConnector.threadDelete(thread),
          Future.chain(success =>
            success
              ? Future.notUsed
              : Future.fromIOEither(log(thread).info("Couldn't delete music thread")),
          ),
          orElse,
        ),
      ),
    )

    const messageDelete = pipe(
      maybeMessage,
      futureMaybe.chainTaskEitherK(message =>
        pipe(
          DiscordConnector.messageDelete(message),
          Future.chain(success =>
            success
              ? Future.notUsed
              : Future.fromIOEither(log(message.channel).warn("Couldn't delete music message")),
          ),
          orElse,
        ),
      ),
    )

    return pipe(
      apply.sequenceT(Future.ApplySeq)(audioPlayerStop, threadDelete, messageDelete),
      Future.map(() => AudioState.disconnected),
    )
  }

  function onPlayerIdle(state: AudioState): Future<AudioState> {
    switch (state.type) {
      case 'Disconnected':
        return Future.successful(state)

      case 'Connecting':
        return pipe(
          logger.warn(`Inconsistent state: onPlayerIdle while state was ${state.type}`),
          Future.fromIOEither,
          Future.map(() => state),
        )

      case 'Connected':
        return pipe(
          state,
          AudioStateNotDisconnected.foldValue<'AudioStateConnected'>()({
            onMusic: musicState =>
              List.isEmpty(musicState.value.queue)
                ? pipe(
                    voiceConnectionDestroy(musicState.voiceConnection),
                    Future.map(() => musicState),
                  )
                : playMusicFirstTrackFromQueue(musicState),
            onElevator: flow(playElevatorFile, Future.fromIOEither),
          }),
        )
    }
  }

  /**
   * Helpers
   */

  function queueStateReducer(f: (oldState: AudioState) => Future<AudioState>): IO<NotUsed> {
    return stateReducers.queue(
      pipe(
        audioState.get,
        Future.fromIO,
        Future.chain(oldState =>
          pipe(
            f(oldState),
            Future.chain(newState =>
              refreshMusicMessageAndSendPendingEvents({ oldState, newState }),
            ),
            Future.chainFirstIOEitherK(newState =>
              AudioState.Eq.equals(oldState, newState)
                ? IO.notUsed
                : serverToClientEventSubject.next(ServerToClientEvent.guildStateUpdated),
            ),
          ),
        ),
        Future.chain(flow(audioState.set, Future.fromIO)),
        Future.map(toNotUsed),
      ),
    )
  }

  function getConnecting<A extends AudioStateValue>(
    channel: GuildAudioChannel,
    value: A,
  ): Future<AudioStateConnecting<A>> {
    return connecting(
      channel,
      initStateMessage(value),
      joinVoiceChannel(channel),
      createAudioPlayer(),
    )
  }

  function joinVoiceChannel(channel: GuildAudioChannel): IO<VoiceConnection> {
    return pipe(
      DiscordConnector.voiceConnectionJoin(channel),
      IO.chainFirst(voiceConnection => {
        const connectionPub = PubSubUtils.publish(getOnError(logger))(audioEvents.subject.next)(
          'on',
        )<VoiceConnectionEvents>(voiceConnection)
        return apply.sequenceT(IO.ApplyPar)(
          connectionPub('error', AudioEvent.ConnectionError),
          connectionPub(VoiceConnectionStatus.Signalling, AudioEvent.ConnectionSignalling),
          connectionPub(VoiceConnectionStatus.Connecting, AudioEvent.ConnectionConnecting),
          connectionPub(VoiceConnectionStatus.Ready, AudioEvent.ConnectionReady),
          connectionPub(VoiceConnectionStatus.Disconnected, AudioEvent.ConnectionDisconnected),
          connectionPub(VoiceConnectionStatus.Destroyed, AudioEvent.ConnectionDestroyed),
        )
      }),
    )
  }

  function createAudioPlayer(): IO<AudioPlayer> {
    return pipe(
      DiscordConnector.audioPlayerCreate,
      IO.chainFirst(audioPlayer => {
        const playerPub = PubSubUtils.publish(getOnError(logger))(audioEvents.subject.next)(
          'on',
        )<AudioPlayerEvents>(audioPlayer)
        return apply.sequenceT(IO.ApplyPar)(
          playerPub('error', AudioEvent.PlayerError),
          playerPub(AudioPlayerStatus.Idle, AudioEvent.PlayerIdle),
          playerPub(AudioPlayerStatus.Buffering, AudioEvent.PlayerBuffering),
          playerPub(AudioPlayerStatus.Paused, AudioEvent.PlayerPaused),
          playerPub(AudioPlayerStatus.Playing, AudioEvent.PlayerPlaying),
          playerPub(AudioPlayerStatus.AutoPaused, AudioEvent.PlayerAutoPaused),
        )
      }),
    )
  }

  function playMusicFirstTrackFromQueue(
    state: AudioStateConnected<AudioStateValueMusic>,
  ): Future<AudioStateConnected<AudioStateValueMusic>> {
    return pipe(
      state.value.queue,
      List.match(
        () => Future.successful(state),
        flow(NonEmptyArray.unprepend, ([head, tail]) =>
          pipe(
            ytDlp.audioResource(head),
            Future.chainIOEitherK(audioResource =>
              DiscordConnector.audioPlayerPlayAudioResource(state.audioPlayer, audioResource),
            ),
            Future.chainIOEitherK(() => DiscordConnector.audioPlayerUnpause(state.audioPlayer)),
            Future.map(() =>
              pipe(
                state,
                AudioStateNotDisconnected.modifyValue<'AudioStateConnected'>()(
                  flow(
                    AudioStateValue.setIsPaused(false),
                    AudioStateValueMusic.setCurrentTrack(Maybe.some(head)),
                    AudioStateValueMusic.setQueue(tail),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    )
  }

  function playElevatorFile(
    state: AudioStateConnected<AudioStateValueElevator>,
  ): IO<AudioStateConnected<AudioStateValueElevator>> {
    const audioResource = pipe(
      state.value.playlist,
      NonEmptyArray.head,
      ResourcesHelper.audioResourceFromOggFile,
    )
    return pipe(
      DiscordConnector.audioPlayerPlayAudioResource(state.audioPlayer, audioResource),
      IO.map(() =>
        pipe(
          state,
          AudioStateNotDisconnected.modifyValue<'AudioStateConnected'>()(
            AudioStateValueElevator.rotatePlaylist,
          ),
        ),
      ),
    )
  }

  function playPauseTrackCommon(
    updateAudioPlayer: (audioPlayer: AudioPlayer) => IO<unknown>,
    newIsPaused: boolean,
  ): <A extends AudioStateValue>(state: AudioStateConnected<A>) => IO<AudioStateConnected<A>> {
    return state =>
      pipe(
        updateAudioPlayer(state.audioPlayer),
        IO.map(() =>
          pipe(
            state,
            AudioStateNotDisconnected.modifyValue<'AudioStateConnected'>()(
              AudioStateValue.setIsPaused(newIsPaused),
            ),
          ),
        ),
      )
  }

  function voiceConnectionDestroy(voiceConnection: VoiceConnection): Future<NotUsed> {
    return pipe(
      DiscordConnector.voiceConnectionDestroy(voiceConnection),
      Future.fromIOEither,
      Future.orElseIOEitherK(e => (isAlreadyDestroyedError(e) ? IO.notUsed : logger.warn(e))),
    )
  }

  // function loggerObserver(): TObserver<MusicEvent> {
  //   return {
  //     next: flow(event => {
  //       switch (event.type) {
  //         case 'ConnectionError':
  //         case 'PlayerError':
  //           return logger.warn(event.type, event.error)

  //         case 'ConnectionSignalling':
  //         case 'ConnectionConnecting':
  //         case 'ConnectionReady':
  //         case 'ConnectionDisconnected':
  //         case 'ConnectionDestroyed':

  //         case 'PlayerIdle':
  //         case 'PlayerBuffering':
  //         case 'PlayerPaused':
  //         case 'PlayerPlaying':
  //         case 'PlayerAutoPaused':
  //           const { type, oldState, newState } = event
  //           return logger.info(`✉️  ${type} ${oldState.status} > ${newState.status}`)
  //       }
  //     }, Future.fromIOEither),
  //   }
  // }

  function stringify(): string {
    return `<AudioSubscription[${guild.name}]>`
  }
}

export const AudioSubscription = { of }

const connecting = <A extends AudioStateValue>(
  channel: GuildAudioChannel,
  futureValue: Future<A>,
  voiceConnectionIo: IO<VoiceConnection>,
  audioPlayerIo: IO<AudioPlayer>,
): Future<AudioStateConnecting<A>> =>
  pipe(
    apply.sequenceS(Future.ApplyPar)({
      value: futureValue,
      voiceConnection: Future.fromIOEither(voiceConnectionIo),
      audioPlayer: Future.fromIOEither(audioPlayerIo),
    }),
    Future.map(({ value, voiceConnection, audioPlayer }) =>
      AudioState.connecting(channel, value, voiceConnection, audioPlayer),
    ),
  )

const initStateMessage = <A extends AudioStateValue>(value: A): Future<A> =>
  pipe(
    sendStateMessageAndStartThread(value.type, value.messageChannel),
    Future.map(message => pipe(value, AudioStateValue.setMessage(message))),
  )

const sendStateMessageAndStartThread = (
  type: AudioStateValue['type'],
  channel: GuildSendableChannel,
): Future<Maybe<Message<true>>> =>
  pipe(
    PlayerStateMessage.connecting[type],
    Future.fromIO,
    Future.chain(options => DiscordConnector.sendMessage(channel, options)),
    futureMaybe.chainFirstTaskEitherK(message =>
      DiscordConnector.messageStartThread(message, {
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
      }),
    ),
  )

const refreshMusicMessageAndSendPendingEvents = (
  oldAndNewState: OldAndNewState<AudioState>,
): Future<AudioState> => {
  const { oldState, newState } = oldAndNewState

  if (!AudioState.isNotConnected(newState)) return Future.successful(newState)

  return pipe(
    newState.value.message,
    Maybe.fold(
      () => Future.successful(newState),
      flow(
        refreshMusicMessage({ oldState, newState }),
        Future.map(() => newState),
      ),
    ),
    Future.chain(sendPendingEventsAndUpdateState),
  )
}

const refreshMusicMessage =
  ({
    oldState,
    newState,
  }: OldAndNewState<AudioState, AudioStateNotDisconnected<AudioStateValue>>) =>
  (message: Message<true>): Future<NotUsed> => {
    const newDeps = PlayerMessageDeps.fromState(newState)

    const shouldUpdate =
      !AudioState.isNotConnected(oldState) ||
      !PlayerMessageDeps.Eq.equals(PlayerMessageDeps.fromState(oldState), newDeps)

    if (!shouldUpdate) return Future.notUsed

    return pipe(
      getPlayerMessage(newDeps),
      Future.fromIO,
      Future.chain(options => DiscordConnector.messageEdit(message, options)),
      Future.map(toNotUsed),
    )
  }

const getPlayerMessage = (deps: PlayerMessageDeps): io.IO<BaseMessageOptions> => {
  if (deps.audioStateType !== 'Connected') {
    switch (deps.type) {
      case 'Music':
        return PlayerStateMessage.connecting.Music

      case 'Elevator':
        return PlayerStateMessage.connecting.Elevator
    }
  } else {
    const { isPaused } = deps

    switch (deps.type) {
      case 'Music':
        const { currentTrack, queue } = deps
        return PlayerStateMessage.playing.music(currentTrack, queue, { isPaused })

      case 'Elevator':
        const { playlist } = deps
        return PlayerStateMessage.playing.elevator(pipe(playlist, NonEmptyArray.rotate(1)), {
          isPaused,
        })
    }
  }
}

const sendPendingEventsAndUpdateState = <A extends AudioStateValue>(
  state: AudioStateNotDisconnected<A>,
): Future<AudioStateNotDisconnected<A>> => {
  const { pendingEvents } = state.value

  if (!List.isNonEmpty(pendingEvents)) return Future.successful(state)

  return pipe(
    state.value.message,
    Maybe.chain(m => Maybe.fromNullable(m.thread)),
    Maybe.fold(
      () => Future.successful(state),
      thread =>
        pipe(
          pendingEvents,
          NonEmptyArray.traverse(Future.ApplicativeSeq)(event =>
            DiscordConnector.sendPrettyMessage(thread, event),
          ),
          Future.map(() =>
            pipe(
              state,
              AudioStateNotDisconnected.modifyValue()(AudioStateValue.emptyPendingEvents),
            ),
          ),
        ),
    ),
  )
}

const isAlreadyDestroyedError = (e: Error): boolean =>
  e.message === 'Cannot destroy VoiceConnection - it has already been destroyed'

// const logState = (state: AudioState): unknown => {
//   if (AudioState.isDisconnected(state)) return state
//   return {
//     type: state.type,
//     channel: state.channel.name,
//     value: pipe(
//       state.value,
//       AudioStateValue.fold({
//         onMusic: value => ({
//           type: value.type,
//           isPaused: value.isPaused,
//           currentTrack: pipe(
//             value.currentTrack,
//             Maybe.map(t => t.title),
//             Maybe.toNullable,
//           ),
//           queue: value.queue.map(t => t.title),
//           messageChannel: value.messageChannel.name,
//           message: pipe(
//             value.message,
//             Maybe.map(m => `Message#${m.id}`),
//             Maybe.toNullable,
//           ),
//           pendingEvents: value.pendingEvents,
//         }),
//         onElevator: value => ({
//           type: value.type,
//           playlist: value.playlist.map(f => f.basename),
//         }),
//       }),
//     ),
//     voiceConnection: { state: { status: state.voiceConnection.state.status } },
//     audioPlayer: { state: { status: state.audioPlayer.state.status } },
//     ...(state.type === 'Connected'
//       ? {
//           subscription: pipe(
//             state.subscription,
//             Maybe.map(() => 'Subscription<...>'),
//             Maybe.toNullable,
//           ),
//         }
//       : {}),
//   }
// }
