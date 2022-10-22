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
import { flow, pipe } from 'fp-ts/function'

import type { LoggerType } from '../../shared/models/LoggerType'
import { Store } from '../../shared/models/Store'
import { AsyncQueue } from '../../shared/models/rx/AsyncQueue'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { LogUtils } from '../../shared/utils/LogUtils'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { AudioStateConnected, AudioStateConnecting } from '../models/audio/AudioState'
import { AudioState, AudioStateConnect } from '../models/audio/AudioState'
import {
  AudioStateValue,
  AudioStateValueElevator,
  AudioStateValueMusic,
} from '../models/audio/AudioStateValue'
import { Track } from '../models/audio/music/Track'
import { AudioEvent } from '../models/event/AudioEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildAudioChannel, GuildSendableChannel, NamedChannel } from '../utils/ChannelUtils'
import { DiscordConnector } from './DiscordConnector'
import { ResourcesHelper } from './ResourcesHelper'
import type { YtDlp } from './YtDlp'
import { MusicEventMessage } from './messages/MusicEventMessage'
import { MusicStateMessage } from './messages/MusicStateMessage'

// TODO: constants
const threadName = 'D-Jean Plank'

/* eslint-disable functional/no-return-void */
type VoiceConnectionEvents = {
  readonly error: (error: Error) => void
} & {
  readonly [S in VoiceConnectionStatus]: (
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState & { readonly status: S },
  ) => void
}

type AudioPlayerEvents = {
  readonly error: (error: Error) => void
} & {
  readonly [S in AudioPlayerStatus]: (
    oldState: AudioPlayerState,
    newState: AudioPlayerState & {
      readonly status: S
    },
  ) => void
}
/* eslint-enable functional/no-return-void */

type VoiceConnectionAndAudioPlayer = {
  readonly voiceConnection: VoiceConnection
  readonly audioPlayer: AudioPlayer
}

export type OldAndNewState<A, B = A> = {
  readonly oldState: A
  readonly newState: B
}

export type AudioSubscription = ReturnType<typeof AudioSubscription>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const AudioSubscription = (
  Logger: LoggerGetter,
  resourcesHelper: ResourcesHelper,
  ytDlp: YtDlp,
  guild: Guild,
) => {
  const logger = Logger(`AudioSubscription-${guild.name}#${guild.id}`)

  const audioState = Store<AudioState>(AudioState.disconnected)

  const stateReducers = AsyncQueue<NotUsed>(LogUtils.onError(logger))

  const getAudioState: io.IO<AudioState> = audioState.get

  const disconnect: Future<NotUsed> = pipe(
    audioState.get,
    Future.fromIO,
    Future.chain(state =>
      AudioState.isDisconnected(state)
        ? Future.notUsed
        : voiceConnectionDestroy(state.voiceConnection),
    ),
  )

  return {
    getAudioState,
    disconnect,

    queueTracks,
    playNextTrack,
    playPauseTrack,
    startElevator,

    stringify,
  }

  function queueTracks(
    author: User,
    audioChannel: GuildAudioChannel,
    messageChannel: GuildSendableChannel,
    tracks: NonEmptyArray<Track>,
  ): IO<NotUsed> {
    const event = MusicEventMessage.tracksAdded(author, tracks)

    const queueTracksValueMusic = AudioStateValueMusic.queueTracks(tracks, event)
    const queueTracksValue = AudioStateValue.fold({
      onMusic: queueTracksValueMusic,
      onElevator: () => pipe(AudioStateValueMusic.empty(messageChannel), queueTracksValueMusic),
    })

    return queueStateReducer(state =>
      AudioState.isDisconnected(state)
        ? getConnecting(
            audioChannel,
            pipe(AudioStateValueMusic.empty(messageChannel), queueTracksValueMusic),
          )
        : pipe(state, AudioStateConnect.modifyValue()(queueTracksValue), Future.right),
    )
  }

  function playNextTrack(author: User): IO<NotUsed> {
    return queueStateReducer(state => {
      switch (state.type) {
        case 'Disconnected':
        case 'Connecting':
          return Future.right(state)

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
              onElevator: Future.right,
            }),
          )
      }
    })
  }

  function playPauseTrack(): IO<NotUsed> {
    return queueStateReducer(state => {
      switch (state.type) {
        case 'Disconnected':
        case 'Connecting':
          return Future.right(state)

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
              onElevator: Future.right,
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
          return pipe(
            logger.warn(`startElevator was called while state was ${state.type}. Weird.`),
            Future.fromIOEither,
            Future.map(() => state),
          )
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
            case 'ConnectionDestroyed':
              return onConnectionDisconnectedOrDestroyed(state)

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
        return Future.right(state)

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

  function onConnectionDisconnectedOrDestroyed(state: AudioState): Future<AudioState> {
    if (AudioState.isDisconnected(state)) return Future.right(state)

    const log = (chan?: NamedChannel): LoggerType => LogUtils.pretty(logger, guild, null, chan)
    const orElse = Future.orElseIOEitherK(e => logger.warn(e.stack))

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
        return Future.right(state)

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
    return pipe(
      getVoiceConnectionAndAudioPlayer(channel),
      Future.fromIOEither,
      Future.bind('newValue', (): Future<A> => {
        switch (value.type) {
          case 'Music':
            return pipe(
              sendMusicMessageAndStartThread(value.messageChannel),
              Future.map(message => pipe(value, AudioStateValueMusic.setMessage(message))),
            ) as Future<A>

          case 'Elevator':
            return Future.right(value)
        }
      }),
      Future.map(({ voiceConnection, audioPlayer, newValue }) =>
        AudioState.connecting(channel, newValue, voiceConnection, audioPlayer),
      ),
    )
  }

  function getVoiceConnectionAndAudioPlayer(
    audioChannel: GuildAudioChannel,
  ): IO<VoiceConnectionAndAudioPlayer> {
    const { observable, subject } = PubSub<AudioEvent>()

    const sub = PubSubUtils.subscribeWithRefinement(logger, observable)
    const subscribe = apply.sequenceT(IO.ApplyPar)(sub(lifecycleObserver()))

    return pipe(
      apply.sequenceS(IO.ApplyPar)({
        voiceConnection: joinVoiceChannel(subject, audioChannel),
        audioPlayer: createAudioPlayer(subject),
      }),
      IO.apFirst(subscribe),
    )
  }

  function joinVoiceChannel(
    subject: TSubject<AudioEvent>,
    channel: GuildAudioChannel,
  ): IO<VoiceConnection> {
    return pipe(
      DiscordConnector.voiceConnectionJoin(channel),
      IO.chainFirst(voiceConnection => {
        const connectionPub = PubSubUtils.publish(LogUtils.onError(logger))(subject.next)(
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

  function createAudioPlayer(subject: TSubject<AudioEvent>): IO<AudioPlayer> {
    return pipe(
      DiscordConnector.audioPlayerCreate,
      IO.chainFirst(audioPlayer => {
        const playerPub = PubSubUtils.publish(LogUtils.onError(logger))(subject.next)(
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
        () => Future.right(state),
        flow(NonEmptyArray.unprepend, ([head, tail]) =>
          pipe(
            ytDlp.audioResource(head.url),
            Future.chainIOEitherK(audioResource =>
              DiscordConnector.audioPlayerPlayAudioResource(state.audioPlayer, audioResource),
            ),
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
      Future.orElseIOEitherK(e => (isAlreadyDestroyedError(e) ? IO.notUsed : logger.warn(e.stack))),
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

  if (!AudioState.isMusicValue(newState)) return Future.right(newState)

  return pipe(
    newState.value.message,
    Maybe.fold(
      () => Future.right(newState),
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

  if (!List.isNonEmpty(pendingEvents)) return Future.right(state)

  return pipe(
    state.value.message,
    Maybe.chain(m => Maybe.fromNullable(m.thread)),
    Maybe.fold(
      () => Future.right(state),
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
  readonly type: AudioState['type']
  readonly currentTrack: Maybe<Track>
  readonly queue: List<Track>
  readonly isPaused: boolean
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
