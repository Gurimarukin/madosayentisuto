import type {
  AudioPlayer,
  AudioPlayerState as DiscordAudioPlayerState,
  VoiceConnection,
  VoiceConnectionState,
} from '@discordjs/voice'
import { AudioPlayerStatus } from '@discordjs/voice'
import { VoiceConnectionStatus } from '@discordjs/voice'
import type { Guild, Message, ThreadChannel, User } from 'discord.js'
import { ThreadAutoArchiveDuration } from 'discord.js'
import { apply } from 'fp-ts'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'

import type { LoggerType } from '../../shared/models/LoggerType'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../../shared/models/rx/PubSub'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import { NonEmptyArray, toUnit, todo } from '../../shared/utils/fp'
import { List } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'
import { Future, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { Store } from '../models/Store'
import type { AudioStateConnected } from '../models/audio/AudioState'
import { AudioState } from '../models/audio/AudioState'
import { AudioStateType } from '../models/audio/AudioStateType'
import type { Track } from '../models/audio/music/Track'
import { MusicEvent } from '../models/event/MusicEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildAudioChannel, GuildSendableChannel, NamedChannel } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
import { DiscordConnector } from './DiscordConnector'
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
export const AudioSubscription = (Logger: LoggerGetter, ytDlp: YtDlp, guild: Guild) => {
  const logger = Logger(`AudioSubscription-${guild.name}#${guild.id}`)

  const audioState = Store<AudioState>(AudioState.empty)

  const getState: IO<AudioState> = audioState.get

  const disconnect: Future<void> = pipe(
    audioState.get,
    Future.fromIOEither,
    Future.chain(voiceConnectionDestroy),
  )

  return {
    getState,
    disconnect,

    queueTracks,
    playNextTrack,
    playPauseTrack,

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
      audioState.modify(
        flow(AudioState.queueTracks(tracks), AudioState.setPendingEvent(Maybe.some(event))),
      ),
      Future.fromIOEither,
      Future.chainFirst(refreshMusicMessage),
      Future.chain(newState => {
        switch (newState.type) {
          case 'Disconnected':
            return connect(audioChannel, stateChannel)

          case 'Connecting':
          case 'Connected':
            return logEventToThread(newState)(event)
        }
      }),
    )
  }

  function playNextTrack(author: User): Future<boolean> {
    return pipe(
      audioState.get,
      Future.fromIOEither,
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
                      playFirstTrackFromQueue(state),
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
      Future.fromIOEither,
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
                  AudioState.setAudioPlayerStatePlaying,
                )
              }
              return updateAudioPlayerState(
                DiscordConnector.audioPlayerPause(audioPlayer),
                AudioState.setAudioPlayerStatePaused,
              )
            }
            return Future.right(false)
        }
      }),
    )
  }

  function connect(
    musicChannel: GuildAudioChannel,
    stateChannel: GuildSendableChannel,
  ): Future<void> {
    const { observable, subject } = PubSub<MusicEvent>()

    const sub = PubSubUtils.subscribeWithRefinement(logger, observable)
    const subscribe = apply.sequenceT(IO.ApplyPar)(sub(lifecycleObserver()))

    return pipe(
      sendStateMessage(stateChannel),
      Future.chain(message =>
        pipe(
          audioState.modify(AudioState.setMessage(message)),
          Future.fromIOEither,
          Future.chainFirst(() => createStateThread(message)),
        ),
      ),
      Future.chain(state =>
        pipe(
          AudioState.getPendingEvent(state),
          Maybe.fold(() => Future.unit, logEventToThread(state)),
        ),
      ),
      Future.chainIOEitherK(() =>
        pipe(
          apply.sequenceS(IO.ApplyPar)({
            voiceConnection: joinVoiceChannel(subject, musicChannel),
            audioPlayer: createAudioPlayer(subject),
          }),
          IO.apFirst(subscribe),
          IO.chain(({ voiceConnection, audioPlayer }) =>
            audioState.modify(
              flow(
                AudioState.getValue,
                Maybe.getOrElseW(() => AudioStateType.musicEmpty),
                AudioState.connecting(musicChannel, voiceConnection, audioPlayer),
              ),
            ),
          ),
        ),
      ),
      Future.map(toUnit),
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
      console.log('>>>>> lifecycleObserver:', event.type)
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
      Future.fromIOEither,
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

                return pipe(
                  IO.Do,
                  IO.apS(
                    'subscription',
                    DiscordConnector.voiceConnectionSubscribe(
                      state.voiceConnection,
                      state.audioPlayer,
                    ),
                  ),
                  IO.bind('connected', ({ subscription }) =>
                    audioState.modify(
                      flow(
                        AudioState.getValue,
                        Maybe.getOrElseW(() => AudioStateType.musicEmpty),
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
                        () => playFirstTrackFromQueue(connected),
                      ),
                    ),
                  ),
                )

              case 'Elevator':
                return todo()
            }
        }
      }),
    )
  }

  function onConnectionDisconnectedOrDestroyed(): Future<void> {
    return pipe(audioState.get, Future.fromIOEither, Future.chain(cleanMessageAndPlayer))
  }

  function cleanMessageAndPlayer(currentState: AudioState): Future<void> {
    const log = (chan?: NamedChannel): LoggerType => LogUtils.pretty(logger, guild, null, chan)

    const orElse = Future.orElseIOEitherK(e => logger.warn(e.stack))

    const message = AudioState.getMessage(currentState)

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
      AudioState.getAudioPlayer(currentState),
      Maybe.fold(() => IO.unit, flow(DiscordConnector.audioPlayerStop, IO.map(toUnit))),
      Future.fromIOEither,
      orElse,
    )

    return pipe(
      apply.sequenceT(Future.ApplyPar)(threadDelete, messageDelete, audioPlayerStop),
      Future.chainIOEitherK(() => audioState.set(AudioState.empty)),
      Future.map(toUnit),
    )
  }

  function onPlayerIdle(): Future<void> {
    return pipe(
      audioState.get,
      Future.fromIOEither,
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

                return playFirstTrackFromQueue(state)

              case 'Elevator':
                return todo()
            }
        }
      }),
    )
  }

  function playFirstTrackFromQueue(state: AudioStateConnected): Future<void> {
    return pipe(
      audioState.get,
      IO.map(
        flow(
          AudioState.getQueue,
          Maybe.getOrElse((): List<Track> => List.empty),
        ),
      ),
      Future.fromIOEither,
      Future.chain(
        List.matchLeft(
          () => Future.unit,
          (head, tail) =>
            pipe(
              audioState.modify(AudioState.setQueue(tail)),
              Future.fromIOEither,
              Future.chain(() => playTrackNow(state.audioPlayer, head)),
            ),
        ),
      ),
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
            AudioState.setCurrentTrack(Maybe.some(track)),
            AudioState.setAudioPlayerStatePlaying,
          ),
        ),
      ),
    )
  }

  function updateState(f: Endomorphism<AudioState>): Future<void> {
    return pipe(audioState.modify(f), Future.fromIOEither, Future.chain(refreshMusicMessage))
  }

  function voiceConnectionDestroy(currentState: AudioState): Future<void> {
    return pipe(
      AudioState.getVoiceConnection(currentState),
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
    Future.fromIOEither,
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

const refreshMusicMessage: (state: AudioState) => Future<void> = flow(
  AudioState.getValue,
  Maybe.filter(AudioStateType.is('Music')),
  futureMaybe.fromOption,
  futureMaybe.chain(({ isPaused, currentTrack, queue, message }) =>
    apply.sequenceS(futureMaybe.ApplyPar)({
      message: futureMaybe.fromOption(message),
      options: futureMaybe.fromIOEither(
        MusicStateMessage.playing(currentTrack, queue, { isPaused }),
      ),
    }),
  ),
  futureMaybe.chainTaskEitherK(({ message, options }) =>
    DiscordConnector.messageEdit(message, options),
  ),
  Future.map(toUnit),
)

const logEventToThread =
  (state: AudioState) =>
  (message: string): Future<void> =>
    pipe(
      AudioState.getMessage(state),
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
      AudioState.getCurrentTrack(state),
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
