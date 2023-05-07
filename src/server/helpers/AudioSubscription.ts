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
import { apply, boolean, eq, string } from 'fp-ts'
import { flow, identity, pipe } from 'fp-ts/function'

import type { LoggerType } from '../../shared/models/LoggerType'
import { Store } from '../../shared/models/Store'
import { Track } from '../../shared/models/audio/music/Track'
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
import { AudioState, AudioStateConnect } from '../models/audio/AudioState'
import {
  AudioStateValue,
  AudioStateValueElevator,
  AudioStateValueMusic,
} from '../models/audio/AudioStateValue'
import { AudioEvent } from '../models/event/AudioEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildAudioChannel, GuildSendableChannel, NamedChannel } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
import { getOnError } from '../utils/getOnError'
import { DiscordConnector } from './DiscordConnector'
import { ResourcesHelper } from './ResourcesHelper'
import type { YtDlp } from './YtDlp'
import { MusicEventMessage } from './messages/MusicEventMessage'
import { MusicStateMessage } from './messages/MusicStateMessage'

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
  startElevator: (audioChannel: GuildAudioChannel) => IO<NotUsed>
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
    const event = MusicEventMessage.tracksAdded(author, tracks)

    const queueTracksValueMusic = AudioStateValueMusic.queueTracks(tracks, event)

    return queueStateReducer(state => {
      if (AudioState.isDisconnected(state)) {
        return getConnecting(
          audioChannel,
          pipe(AudioStateValueMusic.empty(messageChannel), queueTracksValueMusic),
        )
      }

      return pipe(
        state.value,
        AudioStateValue.fold({
          onMusic: flow(
            state.channel.id === audioChannel.id ? queueTracksValueMusic : identity,
            Future.successful,
            Future.map(value => pipe(state, AudioStateConnect.setValue()(value))),
          ),

          onElevator: () => {
            const futureValue = pipe(
              AudioStateValueMusic.empty(messageChannel),
              queueTracksValueMusic,
              initMusicMessage,
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
            AudioStateConnect.foldValue<'AudioStateConnected'>()({
              onMusic: musicState =>
                List.isEmpty(musicState.value.queue)
                  ? pipe(
                      voiceConnectionDestroy(musicState.voiceConnection),
                      Future.map(() => musicState),
                    )
                  : pipe(
                      musicState,
                      AudioStateConnect.modifyValue<'AudioStateConnected'>()(
                        AudioStateValueMusic.appendPendingEvent(
                          MusicEventMessage.trackSkipped(author, musicState.value),
                        ),
                      ),
                      playMusicFirstTrackFromQueue,
                    ),
              onElevator: Future.successful,
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
            AudioStateConnect.foldValue<'AudioStateConnected'>()({
              onMusic: musicState =>
                pipe(
                  musicState,
                  musicState.value.isPaused
                    ? playPauseTrackCommon(DiscordConnector.audioPlayerUnpause, false)
                    : playPauseTrackCommon(DiscordConnector.audioPlayerPause, true),
                  Future.fromIOEither,
                ),
              onElevator: Future.successful,
            }),
          )
      }
    })
  }

  function startElevator(audioChannel: GuildAudioChannel): IO<NotUsed> {
    return queueStateReducer(state => {
      switch (state.type) {
        case 'Disconnected':
          return pipe(
            resourcesHelper.randomElevatorPlaylist,
            Future.fromIO,
            Future.chain(playlist =>
              getConnecting(audioChannel, AudioStateValueElevator.of(playlist)),
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
          AudioStateConnect.foldValue<'AudioStateConnecting'>()({
            onMusic: musicState =>
              List.isEmpty(musicState.value.queue)
                ? pipe(
                    voiceConnectionDestroy(musicState.voiceConnection),
                    Future.map(() => musicState),
                  )
                : onConnectionReadyConnecting(musicState, playMusicFirstTrackFromQueue),
            onElevator: elevatorState =>
              onConnectionReadyConnecting(elevatorState, playElevatorFile),
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

    const maybeMessage = pipe(
      state,
      AudioStateConnect.foldValue()({
        onMusic: musicState => musicState.value.message,
        onElevator: () => Maybe.none,
      }),
      futureMaybe.fromOption,
    )

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
          AudioStateConnect.foldValue<'AudioStateConnected'>()({
            onMusic: musicState =>
              List.isEmpty(musicState.value.queue)
                ? pipe(
                    voiceConnectionDestroy(musicState.voiceConnection),
                    Future.map(() => musicState),
                  )
                : playMusicFirstTrackFromQueue(musicState),
            onElevator: playElevatorFile,
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
      ((): Future<A> => {
        switch (value.type) {
          case 'Music':
            return initMusicMessage(value) as Future<A>

          case 'Elevator':
            return Future.successful(value)
        }
      })(),
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
            ytDlp.audioResource(head.url),
            Future.chainIOEitherK(audioResource =>
              DiscordConnector.audioPlayerPlayAudioResource(state.audioPlayer, audioResource),
            ),
            Future.chainIOEitherK(() => DiscordConnector.audioPlayerUnpause(state.audioPlayer)),
            Future.map(() =>
              pipe(
                state,
                AudioStateConnect.modifyValue<'AudioStateConnected'>()(
                  flow(
                    AudioStateValueMusic.setIsPaused(false),
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
  ): Future<AudioStateConnected<AudioStateValueElevator>> {
    return pipe(
      state.value.playlist,
      NonEmptyArray.head,
      ResourcesHelper.audioResourceFromFile,
      Future.chainIOEitherK(audioResource =>
        DiscordConnector.audioPlayerPlayAudioResource(state.audioPlayer, audioResource),
      ),
      Future.map(() =>
        pipe(
          state,
          AudioStateConnect.modifyValue<'AudioStateConnected'>()(
            AudioStateValueElevator.rotatePlaylist,
          ),
        ),
      ),
    )
  }

  function playPauseTrackCommon(
    updateAudioPlayer: (audioPlayer: AudioPlayer) => IO<unknown>,
    newIsPaused: boolean,
  ): (
    state: AudioStateConnected<AudioStateValueMusic>,
  ) => IO<AudioStateConnected<AudioStateValueMusic>> {
    return state =>
      pipe(
        updateAudioPlayer(state.audioPlayer),
        IO.map(() =>
          pipe(
            state,
            AudioStateConnect.modifyValue<'AudioStateConnected'>()(
              AudioStateValueMusic.setIsPaused(newIsPaused),
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

const initMusicMessage = (value: AudioStateValueMusic): Future<AudioStateValueMusic> =>
  pipe(
    sendMusicMessageAndStartThread(value.messageChannel),
    Future.map(message => pipe(value, AudioStateValueMusic.setMessage(message))),
  )

const sendMusicMessageAndStartThread = (
  channel: GuildSendableChannel,
): Future<Maybe<Message<true>>> =>
  pipe(
    MusicStateMessage.connecting,
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

  if (!AudioState.isMusicValue(newState)) return Future.successful(newState)

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
  ({ oldState, newState }: OldAndNewState<AudioState, AudioStateConnect<AudioStateValueMusic>>) =>
  (message: Message<true>): Future<NotUsed> => {
    const newDeps = MusicMessageDeps.fromState(newState)

    const shouldUpdate =
      !AudioState.isMusicValue(oldState) ||
      !MusicMessageDeps.Eq.equals(MusicMessageDeps.fromState(oldState), newDeps)

    if (!shouldUpdate) return Future.notUsed

    return pipe(
      getMusicMessage(newDeps),
      Future.fromIO,
      Future.chain(options => DiscordConnector.messageEdit(message, options)),
      Future.map(toNotUsed),
    )
  }

const getMusicMessage = ({
  type,
  currentTrack,
  queue,
  isPaused,
}: MusicMessageDeps): io.IO<BaseMessageOptions> =>
  type === 'Connected'
    ? MusicStateMessage.playing(currentTrack, queue, { isPaused })
    : MusicStateMessage.connecting

const sendPendingEventsAndUpdateState = (
  state: AudioStateConnect<AudioStateValueMusic>,
): Future<AudioStateConnect<AudioStateValueMusic>> => {
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
            pipe(state, AudioStateConnect.modifyValue()(AudioStateValueMusic.emptyPendingEvents)),
          ),
        ),
    ),
  )
}

const isAlreadyDestroyedError = (e: Error): boolean =>
  e.message === 'Cannot destroy VoiceConnection - it has already been destroyed'

type MusicMessageDeps = {
  type: AudioState['type']
  currentTrack: Maybe<Track>
  queue: List<Track>
  isPaused: boolean
}

const MusicMessageDeps = {
  fromState: (state: AudioStateConnect<AudioStateValueMusic>): MusicMessageDeps => ({
    type: state.type,
    currentTrack: state.value.currentTrack,
    queue: state.value.queue,
    isPaused: state.value.isPaused,
  }),

  Eq: eq.struct<MusicMessageDeps>({
    type: string.Eq,
    currentTrack: Maybe.getEq(Track.Eq),
    queue: List.getEq(Track.Eq),
    isPaused: boolean.Eq,
  }),
}

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
