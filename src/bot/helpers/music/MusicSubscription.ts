import type {
  AudioPlayer,
  AudioPlayerEvents,
  VoiceConnection,
  VoiceConnectionEvents,
} from '@discordjs/voice'
import { AudioPlayerStatus } from '@discordjs/voice'
import { VoiceConnectionStatus } from '@discordjs/voice'
import type { Guild, StageChannel, TextBasedChannels, VoiceChannel } from 'discord.js'
import { apply, refinement } from 'fp-ts'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'

import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import type { NonEmptyArray } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Future, IO, Maybe } from '../../../shared/utils/fp'

import { Store } from '../../models/Store'
import type {
  MusicEventConnectionDestroyed,
  MusicEventConnectionDisconnected,
  MusicEventConnectionReady,
  MusicEventPlayerIdle,
} from '../../models/events/MusicEvent'
import { MusicEvent } from '../../models/events/MusicEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { AudioPlayerState } from '../../models/music/AudioPlayerState'
import type { MusicStateConnected } from '../../models/music/MusicState'
import { MusicState } from '../../models/music/MusicState'
import type { Track } from '../../models/music/Track'
import { PubSub } from '../../models/rx/PubSub'
import type { TObserver } from '../../models/rx/TObserver'
import type { TSubject } from '../../models/rx/TSubject'
import { PubSubUtils } from '../../utils/PubSubUtils'
import { DiscordConnector } from '../DiscordConnector'
import type { YoutubeDl } from '../YoutubeDl'
import { getMusicStateMessage } from '../getMusicStateMessage'

const { or } = PubSubUtils

type MusicChannel = VoiceChannel | StageChannel

export type MusicSubscription = ReturnType<typeof MusicSubscription>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MusicSubscription = (Logger: LoggerGetter, youtubeDl: YoutubeDl, guild: Guild) => {
  const logger = Logger(`MusicSubscription-${guild.name}`)

  const state = Store<MusicState>(MusicState.empty)

  return {
    getState: state.get,
    queueTracks,
    nextTrack,
    playPauseTrack,
    disconnect: (): Future<void> =>
      pipe(state.get, Future.fromIOEither, Future.chain(voiceConnectionDestroy)),
    stringify,
  }

  function queueTracks(
    musicChannel: MusicChannel,
    stateChannel: TextBasedChannels,
    tracks: NonEmptyArray<Track>,
  ): Future<void> {
    if (musicChannel.guild.id !== guild.id) {
      return Future.left(Error('Called playSong with a wrong guild'))
    }

    return pipe(
      state.update(MusicState.queueTracks(tracks)),
      Future.fromIOEither,
      Future.chainFirst(refreshMessage),
      Future.chain(newState => {
        switch (newState.type) {
          case 'Disconnected':
            return connect(musicChannel, stateChannel)

          case 'Connecting':
          case 'Connected':
            return Future.unit
        }
      }),
    )
  }

  function nextTrack(): Future<boolean> {
    return pipe(
      state.get,
      Future.fromIOEither,
      Future.chain(s => {
        switch (s.type) {
          case 'Disconnected':
          case 'Connecting':
            return Future.right(false)

          case 'Connected':
            return pipe(
              List.isEmpty(s.queue) ? voiceConnectionDestroy(s) : playFirstTrackFromQueue(s),
              Future.map(() => true),
            )
        }
      }),
    )
  }

  function playPauseTrack(): Future<boolean> {
    return pipe(
      state.get,
      Future.fromIOEither,
      Future.chain(s => {
        switch (s.type) {
          case 'Disconnected':
          case 'Connecting':
            return Future.right(false)

          case 'Connected':
            const audioPlayer = s.audioPlayerState.value
            switch (s.audioPlayerState.type) {
              case 'Playing':
                return updateAudioPlayerState(
                  DiscordConnector.audioPlayerPause(audioPlayer),
                  MusicState.setAudioPlayerStatePaused,
                )
              case 'Paused':
                return updateAudioPlayerState(
                  DiscordConnector.audioPlayerUnpause(audioPlayer),
                  MusicState.setAudioPlayerStatePlaying,
                )
            }
        }
      }),
    )
  }

  function connect(musicChannel: MusicChannel, stateChannel: TextBasedChannels): Future<void> {
    const { observable, subject } = PubSub<MusicEvent>()

    const sub = PubSubUtils.subscribe(logger, observable)
    const subscribe = apply.sequenceT(IO.ApplyPar)(
      sub(loggerObserver(), or(refinement.id())),
      sub(
        lifecycleObserver(),
        or(
          MusicEvent.is('ConnectionReady'),
          MusicEvent.is('ConnectionDisconnected'),
          MusicEvent.is('ConnectionDestroyed'),
          MusicEvent.is('PlayerIdle'),
        ),
      ),
    )

    return pipe(
      DiscordConnector.sendMessage(stateChannel, getMusicStateMessage.connecting),
      Future.chainIOEitherK(message => state.update(MusicState.setMessage(message))),
      Future.chainIOEitherK(() =>
        pipe(
          apply.sequenceS(IO.ApplyPar)({
            voiceConnection: joinVoiceChannel(subject, musicChannel),
            audioPlayer: createAudioPlayer(subject),
          }),
          IO.apFirst(subscribe),
          IO.chain(({ voiceConnection, audioPlayer }) =>
            state.update(MusicState.connecting(musicChannel, voiceConnection, audioPlayer)),
          ),
        ),
      ),
      Future.map(() => {}),
    )
  }

  function joinVoiceChannel(
    subject: TSubject<MusicEvent>,
    channel: MusicChannel,
  ): IO<VoiceConnection> {
    return pipe(
      DiscordConnector.voiceConnectionJoin(channel),
      IO.chainFirst(voiceConnection => {
        const connectionPub = PubSubUtils.publishOn<VoiceConnectionEvents, MusicEvent>(
          voiceConnection,
          subject.next,
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
  }

  function createAudioPlayer(subject: TSubject<MusicEvent>): IO<AudioPlayer> {
    return pipe(
      DiscordConnector.audioPlayerCreate,
      IO.chainFirst(audioPlayer => {
        const playerPub = PubSubUtils.publishOn<AudioPlayerEvents, MusicEvent>(
          audioPlayer,
          subject.next,
        )
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
  }

  function lifecycleObserver(): TObserver<
    | MusicEventConnectionReady
    | MusicEventConnectionDisconnected
    | MusicEventConnectionDestroyed
    | MusicEventPlayerIdle
  > {
    return {
      next: event => {
        switch (event.type) {
          case 'ConnectionReady':
            return onConnectionReady()

          case 'ConnectionDisconnected':
          case 'ConnectionDestroyed':
            return onConnectionDisconnectedOrDestroyed()

          case 'PlayerIdle':
            return onPlayerIdle()
        }
      },
    }
  }

  function onConnectionReady(): Future<void> {
    return pipe(
      state.get,
      Future.fromIOEither,
      Future.chain(s => {
        switch (s.type) {
          case 'Disconnected':
          case 'Connected':
            return Future.fromIOEither(
              logger.warn(`Inconsistent state: onConnectionReady while state was ${s.type}`),
            )

          case 'Connecting':
            if (List.isEmpty(s.queue)) return voiceConnectionDestroy(s)

            return pipe(
              IO.Do,
              IO.apS(
                'subscription',
                DiscordConnector.voiceConnectionSubscribe(s.voiceConnection, s.audioPlayer),
              ),
              IO.bind('connected', ({ subscription }) =>
                state.update(
                  MusicState.connected(s.audioPlayer, s.channel, s.voiceConnection, subscription),
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
        }
      }),
    )
  }

  function onConnectionDisconnectedOrDestroyed(): Future<void> {
    return pipe(state.get, Future.fromIOEither, Future.chain(cleanMessageAndPlayer))
  }

  function cleanMessageAndPlayer(currentState: MusicState): Future<void> {
    const orElse = Future.orElse((e: Error) => Future.fromIOEither(logger.warn(e.stack)))

    const messageDelete = pipe(
      currentState.message,
      Maybe.fold(
        () => Future.unit,
        flow(
          DiscordConnector.messageDelete,
          Future.map(() => {}),
        ),
      ),
      orElse,
    )
    const audioPlayerStop = pipe(
      currentState,
      MusicState.getAudioPlayer,
      Maybe.fold(
        () => IO.unit,
        flow(
          DiscordConnector.audioPlayerStop,
          IO.map(() => {}),
        ),
      ),
      Future.fromIOEither,
      orElse,
    )

    return pipe(
      apply.sequenceT(Future.ApplyPar)(messageDelete, audioPlayerStop),
      Future.chainIOEitherK(() => state.set(MusicState.empty)),
      Future.map(() => {}),
    )
  }

  function onPlayerIdle(): Future<void> {
    return pipe(
      state.get,
      Future.fromIOEither,
      Future.chain(s => {
        switch (s.type) {
          case 'Disconnected':
          case 'Connecting':
            return Future.fromIOEither(
              logger.warn(`Inconsistent state: onPlayerIdle while state was ${s.type}`),
            )

          case 'Connected':
            if (List.isEmpty(s.queue)) return voiceConnectionDestroy(s)

            return playFirstTrackFromQueue(s)
        }
      }),
    )
  }

  function playFirstTrackFromQueue({
    audioPlayerState: { value: audioPlayer },
  }: MusicStateConnected): Future<void> {
    return pipe(
      state.get,
      IO.map(({ queue }) => queue),
      Future.fromIOEither,
      Future.chain(
        List.matchLeft(
          () => Future.unit,
          (head, tail) =>
            pipe(
              state.update(MusicState.setQueue(tail)),
              Future.fromIOEither,
              Future.chain(() => playTrackNow(audioPlayer, head)),
            ),
        ),
      ),
    )
  }

  function playTrackNow(audioPlayer: AudioPlayer, track: Track): Future<void> {
    return pipe(
      youtubeDl.audioResource(track.url),
      Future.map(audioResource =>
        DiscordConnector.audioPlayerPlayAudioResource(audioPlayer, audioResource),
      ),
      Future.chain(Future.fromIOEither),
      Future.chain(() =>
        updateState(
          flow(MusicState.setPlaying(Maybe.some(track)), MusicState.setAudioPlayerStatePlaying),
        ),
      ),
    )
  }

  function updateState(f: Endomorphism<MusicState>): Future<void> {
    return pipe(state.update(f), Future.fromIOEither, Future.chain(refreshMessage))
  }

  function refreshMessage(s: MusicState): Future<void> {
    const { message, playing, queue } = s
    const isPlaying =
      MusicState.is('Connected')(s) && AudioPlayerState.is('Playing')(s.audioPlayerState)
    return pipe(
      futureMaybe.fromOption(message),
      futureMaybe.chainFuture(m =>
        DiscordConnector.messageEdit(m, getMusicStateMessage.playing(playing, queue, isPlaying)),
      ),
      Future.map(() => {}),
    )
  }

  function voiceConnectionDestroy(currentState: MusicState): Future<void> {
    return pipe(
      currentState,
      MusicState.getVoiceConnection,
      Maybe.fold(() => IO.unit, DiscordConnector.voiceConnectionDestroy),
      Future.fromIOEither,
      Future.orElse(e =>
        isAlreadyDestroyedError(e) ? Future.unit : Future.fromIOEither(logger.warn(e.stack)),
      ),
    )
  }

  function updateAudioPlayerState(
    audioPlayerEffect: IO<boolean>,
    update: Endomorphism<MusicState>,
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

  function loggerObserver(): TObserver<MusicEvent> {
    return {
      next: flow(event => {
        switch (event.type) {
          case 'ConnectionError':
          case 'PlayerError':
            return logger.warn(event.type, event.error)

          case 'ConnectionSignalling':
          case 'ConnectionConnecting':
          case 'ConnectionReady':
          case 'ConnectionDisconnected':
          case 'ConnectionDestroyed':

          case 'PlayerIdle':
          case 'PlayerBuffering':
          case 'PlayerPaused':
          case 'PlayerPlaying':
          case 'PlayerAutoPaused':
            const { type, oldState, newState } = event
            return logger.debug(`✉️  ${type} ${oldState.status} > ${newState.status}`)
        }
      }, Future.fromIOEither),
    }
  }

  function stringify(): string {
    return `<MusicSubscription[${guild.name}]>`
  }
}

const isAlreadyDestroyedError = (e: Error): boolean =>
  e.message === 'Cannot destroy VoiceConnection - it has already been destroyed'
