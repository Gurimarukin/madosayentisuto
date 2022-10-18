import type {
  AudioPlayer,
  AudioPlayerState as DiscordAudioPlayerState,
  VoiceConnection,
  VoiceConnectionState,
} from '@discordjs/voice'
import { AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice'
import type { BaseMessageOptions, Guild, Message, User } from 'discord.js'
import { ThreadAutoArchiveDuration } from 'discord.js'
import type { io } from 'fp-ts'
import { apply, boolean, eq, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import type { NotUsed } from '../../shared/models/NotUsed'
import { AsyncQueue } from '../../shared/models/rx/AsyncQueue'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import { Future, IO, List, Maybe, NonEmptyArray, toNotUsed, toUnit } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { Store } from '../models/Store'
import type { NewAudioStateConnected, NewAudioStateConnecting } from '../models/audio/NewAudioState'
import { NewAudioState, NewAudioStateConnect } from '../models/audio/NewAudioState'
import {
  NewAudioStateValue,
  NewAudioStateValueElevator,
  NewAudioStateValueMusic,
} from '../models/audio/NewAudioStateValue'
import { Track } from '../models/audio/music/Track'
import { AudioEvent } from '../models/event/AudioEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildAudioChannel, GuildSendableChannel } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
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
    oldState: DiscordAudioPlayerState,
    newState: DiscordAudioPlayerState & {
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

  const audioState = Store<NewAudioState<NewAudioStateValue>>(NewAudioState.disconnected)

  const stateReducers = AsyncQueue<NotUsed>(LogUtils.onError(logger))

  const getAudioState: io.IO<NewAudioState<NewAudioStateValue>> = audioState.get

  const disconnect: Future<NotUsed> = Future.todo()
  // pipe(
  //   audioState.get,
  //   Future.fromIO,
  //   Future.chain(voiceConnectionDestroy),
  // )

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

    const queueTracksValueMusic = NewAudioStateValueMusic.queueTracks(tracks, event)
    const queueTracksValue = NewAudioStateValue.fold({
      onMusic: queueTracksValueMusic,
      onElevator: () => pipe(NewAudioStateValueMusic.empty(messageChannel), queueTracksValueMusic),
    })

    return queueStateReducer(state =>
      NewAudioState.isDisconnected(state)
        ? getConnecting(
            audioChannel,
            pipe(NewAudioStateValueMusic.empty(messageChannel), queueTracksValueMusic),
          )
        : pipe(state, NewAudioStateConnect.modifyValue(queueTracksValue), Future.right),
    )

    // const event = MusicEventMessage.tracksAdded(author, tracks)
    // return pipe(
    //   audioState.get,
    //   io.chain(oldState => {
    //     const newState = pipe(
    //       oldState,
    //       AudioState.value.Music.queue.concat(tracks),
    //       AudioState.value.Music.messageChannel.set(Maybe.some(stateChannel)),
    //       AudioState.value.Music.pendingEvent.set(Maybe.some(event)),
    //     )
    //     return pipe(
    //       audioState.set(newState),
    //       io.map(() => ({ oldState, newState })),
    //     )
    //   }),
    //   Future.fromIO,
    //   Future.chainFirst(({ newState }) => refreshMusicMessage(newState)),
    //   Future.chain(({ oldState, newState }) => {
    //     switch (newState.type) {
    //       case 'Disconnected':
    //         return connect(audioChannel)

    //       case 'Connecting':
    //         return logEventToThread(newState)(event)

    //       case 'Connected':
    //         switch (oldState.value.type) {
    //           case 'Elevator':
    //             return pipe(
    //               initStateMessageAndThread(newState, Maybe.some(stateChannel)),
    //               Future.chain(playMusicFirstTrackFromQueue),
    //             )
    //           case 'Music':
    //             return logEventToThread(newState)(event)
    //         }
    //     }
    //   }),
    // )
  }

  function playNextTrack(author: User): Future<boolean> {
    return Future.todo()
    // return pipe(
    //   audioState.get,
    //   Future.fromIO,
    //   Future.chain(state => {
    //     switch (state.type) {
    //       case 'Disconnected':
    //       case 'Connecting':
    //         return Future.right(false)

    //       case 'Connected':
    //         if (AudioStateType.is('Music')(state.value)) {
    //           return pipe(
    //             List.isEmpty(state.value.queue)
    //               ? voiceConnectionDestroy(state)
    //               : apply.sequenceT(Future.ApplyPar)(
    //                   logEventToThread(state)(MusicEventMessage.trackSkipped(author, state)),
    //                   playMusicFirstTrackFromQueue(state),
    //                 ),
    //             Future.map<unknown, boolean>(() => true),
    //           )
    //         }
    //         return Future.right(false)
    //     }
    //   }),
    // )
  }

  function playPauseTrack(): Future<boolean> {
    return Future.todo()
    // return pipe(
    //   audioState.get,
    //   Future.fromIO,
    //   Future.chain(state => {
    //     switch (state.type) {
    //       case 'Disconnected':
    //       case 'Connecting':
    //         return Future.right(false)

    //       case 'Connected':
    //         if (AudioStateType.is('Music')(state.value)) {
    //           const audioPlayer = state.audioPlayer
    //           if (state.value.isPaused) {
    //             return updateAudioPlayerState(
    //               DiscordConnector.audioPlayerUnpause(audioPlayer),
    //               AudioState.value.Music.isPaused.set(false),
    //             )
    //           }
    //           return updateAudioPlayerState(
    //             DiscordConnector.audioPlayerPause(audioPlayer),
    //             AudioState.value.Music.isPaused.set(true),
    //           )
    //         }
    //         return Future.right(false)
    //     }
    //   }),
    // )
  }

  function startElevator(audioChannel: GuildAudioChannel): Future<NotUsed> {
    return Future.todo()
    // return pipe(
    //   audioState.modify(AudioState.value.set(AudioStateType.Elevator.empty)),
    //   Future.fromIO,
    //   Future.chain(newState => {
    //     switch (newState.type) {
    //       case 'Disconnected':
    //         return connect(audioChannel)

    //       case 'Connecting':
    //       case 'Connected':
    //         return Future.fromIOEither(
    //           logger.warn(`startElevator was called while state was ${newState.type}. Weird.`),
    //         )
    //     }
    //   }),
    // )
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
    )(event => {
      console.log('>>>>> lifecycleObserver - event:', event.type)

      return Future.fromIOEither(
        queueStateReducer(state => {
          switch (event.type) {
            case 'ConnectionReady':
              return onConnectionReady(state)

            case 'ConnectionDisconnected':
            case 'ConnectionDestroyed':
              return Future.todo()
            // return onConnectionDisconnectedOrDestroyed()

            case 'PlayerIdle':
              return Future.todo()
            // return onPlayerIdle()
          }
        }),
      )
    })
  }

  function onConnectionReady(
    state: NewAudioState<NewAudioStateValue>,
  ): Future<NewAudioState<NewAudioStateValue>> {
    switch (state.type) {
      case 'Disconnected':
      case 'Connected':
        return pipe(
          logger.warn(`Inconsistent state: onConnectionReady while state was ${state.type}`),
          Future.fromIOEither,
          Future.map(() => state),
        )

      case 'Connecting':
        return pipe(
          state,
          NewAudioStateConnect.foldValue({
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

  function onConnectionReadyConnecting<A extends NewAudioStateValue>(
    state: NewAudioStateConnecting<A>,
    onConnected: (connected: NewAudioStateConnected<A>) => Future<NewAudioStateConnected<A>>,
  ): Future<NewAudioStateConnected<A>> {
    return pipe(
      DiscordConnector.voiceConnectionSubscribe(state.voiceConnection, state.audioPlayer),
      Future.fromIOEither,
      Future.chain(subscription => {
        const newState = NewAudioState.connected(
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

  /**
   * Helpers
   */

  function queueStateReducer(
    f: (oldState: NewAudioState<NewAudioStateValue>) => Future<NewAudioState<NewAudioStateValue>>,
  ): IO<NotUsed> {
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
    // return withLock(oldState =>
    //   pipe(
    //     f(oldState),
    //     Future.chain(state =>
    //       // do stuff like
    //       // send message if not exists
    //       // refresh message if exists
    //       // remove message if disconnect
    //       // connect if Disconnected > Connecting
    //       // play if Connecting > Connected
    //       Future.right(state),
    //     ),
    //     Future.chain(newState => renderMusicMessageAndSendPendingEvents({ oldState, newState })),
    //   ),
    // )
  }

  // returns false if lock was active, returns true if modify was successful
  // function withLock(
  //   f: (oldState: NewAudioState<NewAudioStateValue>) => Future<NewAudioState<NewAudioStateValue>>,
  // ): Future<boolean> {
  //   return pipe(
  //     lock.get,
  //     Future.fromIO,
  //     Future.chain(isLocked =>
  //       isLocked
  //         ? Future.right(false) // failure
  //         : pipe(
  //             lock.set(true),
  //             io.chain(() => audioState.get),
  //             Future.fromIO,
  //             Future.chain(f),
  //             Future.chainIOK(audioState.set),
  //             Future.chainIOK(() => lock.set(false)),
  //             Future.map(() => true), // success
  //           ),
  //     ),
  //   )
  // }

  function getConnecting<A extends NewAudioStateValue>(
    channel: GuildAudioChannel,
    value: A,
  ): Future<NewAudioStateConnecting<A>> {
    return pipe(
      getVoiceConnectionAndAudioPlayer(channel),
      Future.fromIOEither,
      Future.bind('newValue', (): Future<A> => {
        switch (value.type) {
          case 'Music':
            return pipe(
              sendMusicMessageAndStartThread(value.messageChannel),
              Future.map(message => pipe(value, NewAudioStateValueMusic.setMessage(message))),
            ) as Future<A>
          case 'Elevator':
            return Future.right(value)
        }
      }),
      Future.map(({ voiceConnection, audioPlayer, newValue }) =>
        NewAudioState.connecting(channel, newValue, voiceConnection, audioPlayer),
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

  function playMusicFirstTrackFromQueue(
    state: NewAudioStateConnected<NewAudioStateValueMusic>,
  ): Future<NewAudioStateConnected<NewAudioStateValueMusic>> {
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
                NewAudioStateConnect.modifyValue(
                  flow(
                    NewAudioStateValueMusic.setIsPaused(false),
                    NewAudioStateValueMusic.setCurrentTrack(Maybe.some(head)),
                    NewAudioStateValueMusic.setQueue(tail),
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
    state: NewAudioStateConnected<NewAudioStateValueElevator>,
  ): Future<NewAudioStateConnected<NewAudioStateValueElevator>> {
    return pipe(
      resourcesHelper.randomElevatorMusic(state.value.currentFile),
      Future.fromIO,
      Future.chainFirst(
        flow(
          ResourcesHelper.audioResourceFromFile,
          Future.chainIOEitherK(audioResource =>
            DiscordConnector.audioPlayerPlayAudioResource(state.audioPlayer, audioResource),
          ),
        ),
      ),
      Future.map(file =>
        pipe(
          state,
          NewAudioStateConnect.modifyValue(
            NewAudioStateValueElevator.setCurrentFile(Maybe.some(file)),
          ),
        ),
      ),
    )
  }

  // function connect(audioChannel: GuildAudioChannel): Future<void> {
  //   const { observable, subject } = PubSub<MusicEvent>()

  //   const sub = PubSubUtils.subscribeWithRefinement(logger, observable)
  //   const subscribe = apply.sequenceT(IO.ApplyPar)(sub(lifecycleObserver()))

  //   return pipe(
  //     audioState.get,
  //     Future.fromIO,
  //     Future.chain(state => {
  //       switch (state.value.type) {
  //         case 'Elevator':
  //           return Future.right(state)
  //         case 'Music':
  //           return initStateMessageAndThread(state, state.value.messageChannel)
  //       }
  //     }),
  //     Future.chainIOEitherK(() =>
  //       pipe(
  //         apply.sequenceS(IO.ApplyPar)({
  //           voiceConnection: joinVoiceChannel(subject, audioChannel),
  //           audioPlayer: createAudioPlayer(subject),
  //         }),
  //         IO.apFirst(subscribe),
  //         IO.chainIOK(({ voiceConnection, audioPlayer }) =>
  //           audioState.modify(AudioState.connecting(audioChannel, voiceConnection, audioPlayer)),
  //         ),
  //       ),
  //     ),
  //     Future.map(toUnit),
  //   )
  // }

  // function initStateMessageAndThread(
  //   state: AudioState,
  //   messageChannel: Maybe<GuildSendableChannel>,
  // ): Future<AudioState> {
  //   return pipe(
  //     messageChannel,
  //     Maybe.fold(
  //       () => Future.right(state),
  //       flow(
  //         sendStateMessage,
  //         Future.chain(message =>
  //           pipe(
  //             audioState.modify(AudioState.value.Music.message.set(message)),
  //             Future.fromIO,
  //             Future.chainFirst(() => createStateThread(message)),
  //           ),
  //         ),
  //       ),
  //     ),
  //     Future.chainFirst(s =>
  //       pipe(
  //         s,
  //         AudioState.value.Music.pendingEvent.get,
  //         Maybe.fold(() => Future.unit, logEventToThread(s)),
  //       ),
  //     ),
  //   )
  // }

  // function onConnectionDisconnectedOrDestroyed(): Future<void> {
  //   return pipe(audioState.get, Future.fromIO, Future.chain(cleanMessageAndPlayer))
  // }

  // function cleanMessageAndPlayer(currentState: AudioState): Future<void> {
  //   const log = (chan?: NamedChannel): LoggerType => LogUtils.pretty(logger, guild, null, chan)

  //   const orElse = Future.orElseIOEitherK(e => logger.warn(e.stack))

  //   const message = AudioState.value.Music.message.get(currentState)

  //   const threadDelete = pipe(
  //     message,
  //     Maybe.chain(m => Maybe.fromNullable(m.thread)),
  //     Maybe.fold(
  //       () => Future.unit,
  //       thread =>
  //         pipe(
  //           DiscordConnector.threadDelete(thread),
  //           Future.chain(success =>
  //             success
  //               ? Future.unit
  //               : Future.fromIOEither(log(thread).info("Couldn't delete music thread")),
  //           ),
  //         ),
  //     ),
  //   )

  //   const messageDelete = pipe(
  //     message,
  //     Maybe.fold(
  //       () => Future.unit,
  //       msg =>
  //         pipe(
  //           DiscordConnector.messageDelete(msg),
  //           Future.chain(success =>
  //             success
  //               ? Future.unit
  //               : Future.fromIOEither(log(msg.channel).warn("Couldn't delete music message")),
  //           ),
  //         ),
  //     ),
  //     orElse,
  //   )
  //   const audioPlayerStop = pipe(
  //     currentState,
  //     AudioState.audioPlayer.get,
  //     Maybe.fold(() => IO.unit, flow(DiscordConnector.audioPlayerStop, IO.map(toUnit))),
  //     Future.fromIOEither,
  //     orElse,
  //   )

  //   return pipe(
  //     apply.sequenceT(Future.ApplyPar)(threadDelete, messageDelete, audioPlayerStop),
  //     Future.chainIOK(() => audioState.set(AudioState.empty)),
  //     Future.map(toUnit),
  //   )
  // }

  // function onPlayerIdle(): Future<void> {
  //   return pipe(
  //     audioState.get,
  //     Future.fromIO,
  //     Future.chain(state => {
  //       switch (state.type) {
  //         case 'Disconnected':
  //         case 'Connecting':
  //           return Future.fromIOEither(
  //             logger.warn(`Inconsistent state: onPlayerIdle while state was ${state.type}`),
  //           )

  //         case 'Connected':
  //           switch (state.value.type) {
  //             case 'Music':
  //               if (List.isEmpty(state.value.queue)) return voiceConnectionDestroy(state)

  //               return playMusicFirstTrackFromQueue(state)

  //             case 'Elevator':
  //               return playElevatorFile(state)
  //           }
  //       }
  //     }),
  //   )
  // }

  // function updateState(f: Endomorphism<AudioState>): Future<void> {
  //   return pipe(audioState.modify(f), Future.fromIO, Future.chain(refreshMusicMessage))
  // }

  // TODO: maybe shrink state type (to Connect)
  function voiceConnectionDestroy(voiceConnection: VoiceConnection): Future<NotUsed> {
    return pipe(
      DiscordConnector.voiceConnectionDestroy(voiceConnection),
      Future.fromIOEither,
      Future.map(toNotUsed),
      Future.orElseIOEitherK(e => (isAlreadyDestroyedError(e) ? IO.notUsed : logger.warn(e.stack))),
    )
  }

  // function updateAudioPlayerState(
  //   audioPlayerEffect: IO<boolean>,
  //   update: Endomorphism<AudioState>,
  // ): Future<boolean> {
  //   return pipe(
  //     audioPlayerEffect,
  //     Future.fromIOEither,
  //     Future.chain(success =>
  //       success
  //         ? pipe(
  //             updateState(update),
  //             Future.map(() => true),
  //           )
  //         : Future.right(false),
  //     ),
  //   )
  // }

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

// const sendStateMessage = (stateChannel: GuildSendableChannel): Future<Maybe<Message<true>>> =>
//   pipe(
//     MusicStateMessage.connecting,
//     Future.fromIO,
//     Future.chain(options => DiscordConnector.sendMessage(stateChannel, options)),
//   )

// const createStateThread = (maybeMessage: Maybe<Message>): Future<Maybe<ThreadChannel>> =>
//   pipe(
//     futureMaybe.fromOption(maybeMessage),
//     futureMaybe.chainTaskEitherK(message =>
//       DiscordConnector.messageStartThread(message, {
//         name: threadName,
//         autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
//       }),
//     ),
//   )

const joinVoiceChannel = (
  subject: TSubject<AudioEvent>,
  channel: GuildAudioChannel,
): IO<VoiceConnection> =>
  pipe(
    DiscordConnector.voiceConnectionJoin(channel),
    IO.chainFirst(voiceConnection => {
      const connectionPub = PubSubUtils.publish(subject.next)('on')<VoiceConnectionEvents>(
        voiceConnection,
      )
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

const createAudioPlayer = (subject: TSubject<AudioEvent>): IO<AudioPlayer> =>
  pipe(
    DiscordConnector.audioPlayerCreate,
    IO.chainFirst(audioPlayer => {
      const playerPub = PubSubUtils.publish(subject.next)('on')<AudioPlayerEvents>(audioPlayer)
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

// const sendMusicMessageAndUpdateState = (
//   value: NewAudioStateValueMusic,
// ): Future< NewAudioStateValueMusic > =>
//   pipe(
//     sendMusicMessageAndStartThread(state.value.messageChannel,  ),
//     Future.map(
//       Maybe.fold(
//         () => state,
//         message =>
//           pipe(
//             state,
//             NewAudioStateConnect.modifyValue(NewAudioStateValueMusic.setMessage(message)),
//           ),
//       ),
//     ),
//   )

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
  oldAndNewState: OldAndNewState<NewAudioState<NewAudioStateValue>>,
): Future<NewAudioState<NewAudioStateValue>> => {
  const { oldState, newState } = oldAndNewState

  if (!NewAudioState.isMusicValue(newState)) return Future.right(newState)

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
  ({
    oldState,
    newState,
  }: OldAndNewState<
    NewAudioState<NewAudioStateValue>,
    NewAudioStateConnect<NewAudioStateValueMusic>
  >) =>
  (message: Message<true>): Future<void> => {
    const newDeps = MusicMessageDeps.fromState(newState)

    const shouldUpdate =
      !NewAudioState.isMusicValue(oldState) ||
      !MusicMessageDeps.Eq.equals(MusicMessageDeps.fromState(oldState), newDeps)

    if (!shouldUpdate) return Future.unit

    return pipe(
      getMusicMessage(newDeps),
      Future.fromIO,
      Future.chain(options => DiscordConnector.messageEdit(message, options)),
      Future.map(toUnit),
    )
  }

// const refreshMusicMessage = (state: AudioState): Future<void> => {
//   if (!AudioStateType.is('Music')(state.value)) return Future.unit

//   const { isPaused, currentTrack, queue, message: maybeMessage } = state.value
//   return pipe(
//     apply.sequenceS(futureMaybe.ApplyPar)({
//       message: futureMaybe.fromOption(maybeMessage),
//       options: futureMaybe.fromIO(MusicStateMessage.playing(currentTrack, queue, { isPaused })),
//     }),
//     futureMaybe.chainTaskEitherK(({ message, options }) =>
//       DiscordConnector.messageEdit(message, options),
//     ),
//     Future.map(toUnit),
//   )
// }

const sendPendingEventsAndUpdateState = (
  state: NewAudioStateConnect<NewAudioStateValueMusic>,
): Future<NewAudioStateConnect<NewAudioStateValueMusic>> => {
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
            pipe(
              state,
              NewAudioStateConnect.modifyValue(NewAudioStateValueMusic.emptyPendingEvents),
            ),
          ),
        ),
    ),
  )
}

// const logEventToThread =
//   (state: AudioState) =>
//   (message: string): Future<void> =>
//     pipe(
//       state,
//       AudioState.value.Music.message.get,
//       Maybe.chain(m => Maybe.fromNullable(m.thread)),
//       Maybe.fold(
//         () => Future.unit,
//         thread => pipe(DiscordConnector.sendPrettyMessage(thread, message), Future.map(toUnit)),
//       ),
//     )

const isAlreadyDestroyedError = (e: Error): boolean =>
  e.message === 'Cannot destroy VoiceConnection - it has already been destroyed'

// TODO: own file?

const getMusicMessage = ({
  type,
  currentTrack,
  queue,
  isPaused,
}: MusicMessageDeps): io.IO<BaseMessageOptions> =>
  type === 'Connected'
    ? MusicStateMessage.playing(currentTrack, queue, { isPaused })
    : MusicStateMessage.connecting

type MusicMessageDeps = {
  readonly type: NewAudioState<NewAudioStateValue>['type']
  readonly currentTrack: Maybe<Track>
  readonly queue: List<Track>
  readonly isPaused: boolean
}

const MusicMessageDeps = {
  fromState: (state: NewAudioStateConnect<NewAudioStateValueMusic>): MusicMessageDeps => ({
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
