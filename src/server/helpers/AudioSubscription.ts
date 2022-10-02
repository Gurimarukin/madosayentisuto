import type {
  AudioPlayer,
  AudioPlayerState as DiscordAudioPlayerState,
  VoiceConnection,
  VoiceConnectionState,
} from '@discordjs/voice'
import { AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice'
import type { Guild, Message, ThreadChannel, User } from 'discord.js'
import { ThreadAutoArchiveDuration } from 'discord.js'
import { io } from 'fp-ts'
import { apply } from 'fp-ts'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'

import type { LoggerType } from '../../shared/models/LoggerType'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import { NonEmptyArray, toUnit } from '../../shared/utils/fp'
import { List } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'
import { Future, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { MyFile } from '../models/FileOrDir'
import { Store } from '../models/Store'
import type { AudioStateConnected, AudioStateConnecting } from '../models/audio/AudioState'
import { AudioState } from '../models/audio/AudioState'
import { AudioStateType } from '../models/audio/AudioStateType'
import type { Track } from '../models/audio/music/Track'
import { MusicEvent } from '../models/event/MusicEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildAudioChannel, GuildSendableChannel, NamedChannel } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
import { DiscordConnector } from './DiscordConnector'
import { ResourcesHelper } from './ResourcesHelper'
import type { YtDlp } from './YtDlp'
import { MusicStateMessage } from './messages/MusicStateMessage'

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

export type AudioSubscription = ReturnType<typeof AudioSubscription>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const AudioSubscription = (
  Logger: LoggerGetter,
  resourcesHelper: ResourcesHelper,
  ytDlp: YtDlp,
  guild: Guild,
) => {
  const logger = Logger(`AudioSubscription-${guild.name}#${guild.id}`)

  const audioState = Store<AudioState>(AudioState.empty)

  const getState: io.IO<AudioState> = audioState.get

  const disconnect: Future<void> = pipe(
    audioState.get,
    Future.fromIO,
    Future.chain(voiceConnectionDestroy),
  )

  return {
    getState,
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
    stateChannel: GuildSendableChannel,
    tracks: NonEmptyArray<Track>,
  ): Future<void> {
    const event = Events.addedTracks(author, tracks)
    return pipe(
      audioState.get,
      io.chain(oldState => {
        const newState = pipe(
          oldState,
          AudioState.value.Music.queue.concat(tracks),
          AudioState.value.Music.messageChannel.set(Maybe.some(stateChannel)),
          AudioState.value.Music.pendingEvent.set(Maybe.some(event)),
        )
        return pipe(
          audioState.set(newState),
          io.map(() => ({ oldState, newState })),
        )
      }),
      Future.fromIO,
      Future.chainFirst(({ newState }) => refreshMusicMessage(newState)),
      Future.chain(({ oldState, newState }) => {
        switch (newState.type) {
          case 'Disconnected':
            return connect(audioChannel)

          case 'Connecting':
            return logEventToThread(newState)(event)

          case 'Connected':
            switch (oldState.value.type) {
              case 'Elevator':
                return pipe(
                  initStateMessageAndThread(newState, Maybe.some(stateChannel)),
                  Future.chain(playMusicFirstTrackFromQueue),
                )
              case 'Music':
                return logEventToThread(newState)(event)
            }
        }
      }),
    )
  }

  function playNextTrack(author: User): Future<boolean> {
    return pipe(
      audioState.get,
      Future.fromIO,
      Future.chain(state => {
        switch (state.type) {
          case 'Disconnected':
          case 'Connecting':
            return Future.right(false)

          case 'Connected':
            if (AudioStateType.is('Music')(state.value)) {
              return pipe(
                List.isEmpty(state.value.queue)
                  ? voiceConnectionDestroy(state)
                  : apply.sequenceT(Future.ApplyPar)(
                      logEventToThread(state)(Events.skippedTrack(author, state)),
                      playMusicFirstTrackFromQueue(state),
                    ),
                Future.map<unknown, boolean>(() => true),
              )
            }
            return Future.right(false)
        }
      }),
    )
  }

  function playPauseTrack(): Future<boolean> {
    return pipe(
      audioState.get,
      Future.fromIO,
      Future.chain(state => {
        switch (state.type) {
          case 'Disconnected':
          case 'Connecting':
            return Future.right(false)

          case 'Connected':
            if (AudioStateType.is('Music')(state.value)) {
              const audioPlayer = state.audioPlayer
              if (state.value.isPaused) {
                return updateAudioPlayerState(
                  DiscordConnector.audioPlayerUnpause(audioPlayer),
                  AudioState.value.Music.isPaused.set(false),
                )
              }
              return updateAudioPlayerState(
                DiscordConnector.audioPlayerPause(audioPlayer),
                AudioState.value.Music.isPaused.set(true),
              )
            }
            return Future.right(false)
        }
      }),
    )
  }

  function startElevator(audioChannel: GuildAudioChannel): Future<void> {
    return pipe(
      audioState.modify(AudioState.value.set(AudioStateType.Elevator.empty)),
      Future.fromIO,
      Future.chain(newState => {
        switch (newState.type) {
          case 'Disconnected':
            return connect(audioChannel)

          case 'Connecting':
          case 'Connected':
            return Future.fromIOEither(
              logger.warn(`startElevator was called while state was ${newState.type}. Weird.`),
            )
        }
      }),
    )
  }

  function connect(audioChannel: GuildAudioChannel): Future<void> {
    const { observable, subject } = PubSub<MusicEvent>()

    const sub = PubSubUtils.subscribeWithRefinement(logger, observable)
    const subscribe = apply.sequenceT(IO.ApplyPar)(sub(lifecycleObserver()))

    return pipe(
      audioState.get,
      Future.fromIO,
      Future.chain(state => {
        switch (state.value.type) {
          case 'Elevator':
            return Future.right(state)
          case 'Music':
            return initStateMessageAndThread(state, state.value.messageChannel)
        }
      }),
      Future.chainIOEitherK(() =>
        pipe(
          apply.sequenceS(IO.ApplyPar)({
            voiceConnection: joinVoiceChannel(subject, audioChannel),
            audioPlayer: createAudioPlayer(subject),
          }),
          IO.apFirst(subscribe),
          IO.chainIOK(({ voiceConnection, audioPlayer }) =>
            audioState.modify(AudioState.connecting(audioChannel, voiceConnection, audioPlayer)),
          ),
        ),
      ),
      Future.map(toUnit),
    )
  }

  function initStateMessageAndThread(
    state: AudioState,
    messageChannel: Maybe<GuildSendableChannel>,
  ): Future<AudioState> {
    return pipe(
      messageChannel,
      Maybe.fold(
        () => Future.right(state),
        flow(
          sendStateMessage,
          Future.chain(message =>
            pipe(
              audioState.modify(AudioState.value.Music.message.set(message)),
              Future.fromIO,
              Future.chainFirst(() => createStateThread(message)),
            ),
          ),
        ),
      ),
      Future.chainFirst(s =>
        pipe(
          s,
          AudioState.value.Music.pendingEvent.get,
          Maybe.fold(() => Future.unit, logEventToThread(s)),
        ),
      ),
    )
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function lifecycleObserver() {
    return ObserverWithRefinement.fromNext(
      MusicEvent,
      'ConnectionReady',
      'ConnectionDisconnected',
      'ConnectionDestroyed',
      'PlayerIdle',
    )(event => {
      switch (event.type) {
        case 'ConnectionReady':
          return onConnectionReady()

        case 'ConnectionDisconnected':
        case 'ConnectionDestroyed':
          return onConnectionDisconnectedOrDestroyed()

        case 'PlayerIdle':
          return onPlayerIdle()
      }
    })
  }

  function onConnectionReady(): Future<void> {
    return pipe(
      audioState.get,
      Future.fromIO,
      Future.chain(state => {
        switch (state.type) {
          case 'Disconnected':
          case 'Connected':
            return Future.fromIOEither(
              logger.warn(`Inconsistent state: onConnectionReady while state was ${state.type}`),
            )

          case 'Connecting':
            switch (state.value.type) {
              case 'Music':
                if (List.isEmpty(state.value.queue)) return voiceConnectionDestroy(state)

                return onConnectionReadyConnecting(state, playMusicFirstTrackFromQueue)

              case 'Elevator':
                return onConnectionReadyConnecting(state, playElevatorFile)
            }
        }
      }),
    )
  }

  function onConnectionReadyConnecting(
    state: AudioStateConnecting,
    onConnected: (connected: AudioStateConnected) => Future<void>,
  ): Future<void> {
    return pipe(
      IO.Do,
      IO.apS(
        'subscription',
        DiscordConnector.voiceConnectionSubscribe(state.voiceConnection, state.audioPlayer),
      ),
      IO.bind('connected', ({ subscription }) =>
        IO.fromIO(
          audioState.modify(
            AudioState.connected(
              state.audioPlayer,
              state.channel,
              state.voiceConnection,
              subscription,
            ),
          ),
        ),
      ),
      Future.fromIOEither,
      Future.chain(({ subscription, connected }) =>
        pipe(
          subscription,
          Maybe.fold(
            () => Future.fromIOEither(logger.error('Subscription failed')),
            () => onConnected(connected),
          ),
        ),
      ),
    )
  }

  function onConnectionDisconnectedOrDestroyed(): Future<void> {
    return pipe(audioState.get, Future.fromIO, Future.chain(cleanMessageAndPlayer))
  }

  function cleanMessageAndPlayer(currentState: AudioState): Future<void> {
    const log = (chan?: NamedChannel): LoggerType => LogUtils.pretty(logger, guild, null, chan)

    const orElse = Future.orElseIOEitherK(e => logger.warn(e.stack))

    const message = AudioState.value.Music.message.get(currentState)

    const threadDelete = pipe(
      message,
      Maybe.chain(m => Maybe.fromNullable(m.thread)),
      Maybe.fold(
        () => Future.unit,
        thread =>
          pipe(
            DiscordConnector.threadDelete(thread),
            Future.chain(success =>
              success
                ? Future.unit
                : Future.fromIOEither(log(thread).info("Couldn't delete music thread")),
            ),
          ),
      ),
    )

    const messageDelete = pipe(
      message,
      Maybe.fold(
        () => Future.unit,
        msg =>
          pipe(
            DiscordConnector.messageDelete(msg),
            Future.chain(success =>
              success
                ? Future.unit
                : Future.fromIOEither(log(msg.channel).warn("Couldn't delete music message")),
            ),
          ),
      ),
      orElse,
    )
    const audioPlayerStop = pipe(
      currentState,
      AudioState.audioPlayer.get,
      Maybe.fold(() => IO.unit, flow(DiscordConnector.audioPlayerStop, IO.map(toUnit))),
      Future.fromIOEither,
      orElse,
    )

    return pipe(
      apply.sequenceT(Future.ApplyPar)(threadDelete, messageDelete, audioPlayerStop),
      Future.chainIOK(() => audioState.set(AudioState.empty)),
      Future.map(toUnit),
    )
  }

  function onPlayerIdle(): Future<void> {
    return pipe(
      audioState.get,
      Future.fromIO,
      Future.chain(state => {
        switch (state.type) {
          case 'Disconnected':
          case 'Connecting':
            return Future.fromIOEither(
              logger.warn(`Inconsistent state: onPlayerIdle while state was ${state.type}`),
            )

          case 'Connected':
            switch (state.value.type) {
              case 'Music':
                if (List.isEmpty(state.value.queue)) return voiceConnectionDestroy(state)

                return playMusicFirstTrackFromQueue(state)

              case 'Elevator':
                return playElevatorFile(state)
            }
        }
      }),
    )
  }

  function playMusicFirstTrackFromQueue(state: AudioState): Future<void> {
    return pipe(
      apply.sequenceS(Maybe.Apply)({
        audioPlayer: AudioState.audioPlayer.get(state),
        musicQueue: pipe(
          state,
          AudioState.value.Music.queue.get,
          Maybe.chain(NonEmptyArray.fromReadonlyArray),
          Maybe.map(NonEmptyArray.unprepend),
        ),
      }),
      Maybe.fold(
        () => Future.unit,
        ({ audioPlayer, musicQueue: [head, tail] }) =>
          pipe(
            audioState.modify(AudioState.value.Music.queue.set(tail)),
            Future.fromIO,
            Future.chain(() => playTrackNow(audioPlayer, head)),
          ),
      ),
    )
  }

  function playElevatorFile(state: AudioStateConnected): Future<void> {
    return pipe(
      state,
      AudioState.value.Elevator.currentFile.get,
      resourcesHelper.randomElevatorMusic,
      io.chainFirst(flow(Maybe.some, AudioState.value.Elevator.currentFile.set, audioState.modify)),
      Future.fromIO,
      Future.chain(file => playFileNow(state.audioPlayer, file)),
    )
  }

  function playTrackNow(audioPlayer: AudioPlayer, track: Track): Future<void> {
    return pipe(
      ytDlp.audioResource(track.url),
      Future.chainIOEitherK(audioResource =>
        DiscordConnector.audioPlayerPlayAudioResource(audioPlayer, audioResource),
      ),
      Future.chain(() =>
        updateState(
          flow(
            AudioState.value.Music.currentTrack.set(Maybe.some(track)),
            AudioState.value.Music.isPaused.set(false),
          ),
        ),
      ),
    )
  }

  function playFileNow(audioPlayer: AudioPlayer, file: MyFile): Future<void> {
    return pipe(
      ResourcesHelper.audioResourceFromFile(file),
      Future.chainIOEitherK(audioResource =>
        DiscordConnector.audioPlayerPlayAudioResource(audioPlayer, audioResource),
      ),
    )
  }

  function updateState(f: Endomorphism<AudioState>): Future<void> {
    return pipe(audioState.modify(f), Future.fromIO, Future.chain(refreshMusicMessage))
  }

  function voiceConnectionDestroy(currentState: AudioState): Future<void> {
    return pipe(
      currentState,
      AudioState.voiceConnection.get,
      Maybe.fold(() => IO.unit, DiscordConnector.voiceConnectionDestroy),
      Future.fromIOEither,
      Future.orElseIOEitherK(e => (isAlreadyDestroyedError(e) ? IO.unit : logger.warn(e.stack))),
    )
  }

  function updateAudioPlayerState(
    audioPlayerEffect: IO<boolean>,
    update: Endomorphism<AudioState>,
  ): Future<boolean> {
    return pipe(
      audioPlayerEffect,
      Future.fromIOEither,
      Future.chain(success =>
        success
          ? pipe(
              updateState(update),
              Future.map(() => true),
            )
          : Future.right(false),
      ),
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

const sendStateMessage = (stateChannel: GuildSendableChannel): Future<Maybe<Message<true>>> =>
  pipe(
    MusicStateMessage.connecting,
    Future.fromIO,
    Future.chain(options => DiscordConnector.sendMessage(stateChannel, options)),
  )

const createStateThread = (maybeMessage: Maybe<Message>): Future<Maybe<ThreadChannel>> =>
  pipe(
    futureMaybe.fromOption(maybeMessage),
    futureMaybe.chainTaskEitherK(message =>
      DiscordConnector.messageStartThread(message, {
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
      }),
    ),
  )

const joinVoiceChannel = (
  subject: TSubject<MusicEvent>,
  channel: GuildAudioChannel,
): IO<VoiceConnection> =>
  pipe(
    DiscordConnector.voiceConnectionJoin(channel),
    IO.chainFirst(voiceConnection => {
      const connectionPub = PubSubUtils.publish(subject.next)('on')<VoiceConnectionEvents>(
        voiceConnection,
      )
      return apply.sequenceT(IO.ApplyPar)(
        connectionPub('error', MusicEvent.ConnectionError),
        connectionPub(VoiceConnectionStatus.Signalling, MusicEvent.ConnectionSignalling),
        connectionPub(VoiceConnectionStatus.Connecting, MusicEvent.ConnectionConnecting),
        connectionPub(VoiceConnectionStatus.Ready, MusicEvent.ConnectionReady),
        connectionPub(VoiceConnectionStatus.Disconnected, MusicEvent.ConnectionDisconnected),
        connectionPub(VoiceConnectionStatus.Destroyed, MusicEvent.ConnectionDestroyed),
      )
    }),
  )

const createAudioPlayer = (subject: TSubject<MusicEvent>): IO<AudioPlayer> =>
  pipe(
    DiscordConnector.audioPlayerCreate,
    IO.chainFirst(audioPlayer => {
      const playerPub = PubSubUtils.publish(subject.next)('on')<AudioPlayerEvents>(audioPlayer)
      return apply.sequenceT(IO.ApplyPar)(
        playerPub('error', MusicEvent.PlayerError),
        playerPub(AudioPlayerStatus.Idle, MusicEvent.PlayerIdle),
        playerPub(AudioPlayerStatus.Buffering, MusicEvent.PlayerBuffering),
        playerPub(AudioPlayerStatus.Paused, MusicEvent.PlayerPaused),
        playerPub(AudioPlayerStatus.Playing, MusicEvent.PlayerPlaying),
        playerPub(AudioPlayerStatus.AutoPaused, MusicEvent.PlayerAutoPaused),
      )
    }),
  )

const refreshMusicMessage = (state: AudioState): Future<void> => {
  if (!AudioStateType.is('Music')(state.value)) return Future.unit

  const { isPaused, currentTrack, queue, message: maybeMessage } = state.value
  return pipe(
    apply.sequenceS(futureMaybe.ApplyPar)({
      message: futureMaybe.fromOption(maybeMessage),
      options: futureMaybe.fromIO(MusicStateMessage.playing(currentTrack, queue, { isPaused })),
    }),
    futureMaybe.chainTaskEitherK(({ message, options }) =>
      DiscordConnector.messageEdit(message, options),
    ),
    Future.map(toUnit),
  )
}

const logEventToThread =
  (state: AudioState) =>
  (message: string): Future<void> =>
    pipe(
      state,
      AudioState.value.Music.message.get,
      Maybe.chain(m => Maybe.fromNullable(m.thread)),
      Maybe.fold(
        () => Future.unit,
        thread => pipe(DiscordConnector.sendPrettyMessage(thread, message), Future.map(toUnit)),
      ),
    )

const Events = {
  addedTracks: (author: User, tracks: NonEmptyArray<Track>): string => {
    const tracksStr = ((): string => {
      if (tracks.length === 1) {
        const head = NonEmptyArray.head(tracks)
        return ` [${head.title}](${head.url})`
      }
      return pipe(
        tracks,
        List.map(t => `• [${t.title}](${t.url})`),
        List.mkString('\n', '\n', ''),
      )
    })()
    return `**${author}** a ajouté${tracksStr}`
  },

  skippedTrack: (author: User, state: AudioState): string => {
    const additional = pipe(
      state,
      AudioState.value.Music.currentTrack.get,
      Maybe.fold(
        () => '',
        t => `...\n*...et a interrompu [${t.title}](${t.url})*`,
      ),
    )
    return `**${author}** est passé au morceau suivant${additional}`
  },
}

const isAlreadyDestroyedError = (e: Error): boolean =>
  e.message === 'Cannot destroy VoiceConnection - it has already been destroyed'
