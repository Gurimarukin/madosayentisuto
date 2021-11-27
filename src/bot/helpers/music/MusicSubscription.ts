import type { AudioPlayerEvents, VoiceConnectionEvents } from '@discordjs/voice'
import { VoiceConnectionStatus } from '@discordjs/voice'
import { createAudioPlayer, joinVoiceChannel } from '@discordjs/voice'
import type { Guild, StageChannel, VoiceChannel } from 'discord.js'
import { apply, refinement } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { List } from '../../../shared/utils/fp'
import { Future, IO, Maybe } from '../../../shared/utils/fp'

import { Store } from '../../models/Store'
import type {
  MusicEventConnectionConnecting,
  MusicEventConnectionDestroyed,
  MusicEventConnectionDisconnected,
  MusicEventConnectionReady,
  MusicEventConnectionSignalling,
} from '../../models/events/MusicEvent'
import { MusicEvent } from '../../models/events/MusicEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { MusicStateConnected } from '../../models/music/MusicState'
import { MusicState } from '../../models/music/MusicState'
import type { Track } from '../../models/music/Track'
import { PubSub } from '../../models/rx/PubSub'
import type { TObserver } from '../../models/rx/TObserver'
import { PubSubUtils } from '../../utils/PubSubUtils'
import { DiscordConnector } from '../DiscordConnector'

const { or } = PubSubUtils

type MyChannel = VoiceChannel | StageChannel

export type MusicSubscription = ReturnType<typeof MusicSubscription>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MusicSubscription = (Logger: LoggerGetter, guild: Guild) => {
  const logger = Logger(`MusicSubscription-${guild.name}`)

  const state = Store<MusicState>(MusicState.Disconnected())

  const queue = Store<List<Track>>(List.empty)

  return { playTrack, stringify }

  function playTrack(channel: MyChannel, track: Track): IO<void> {
    if (channel.guild.id !== guild.id) return IO.left(Error('Called playSong with a wrong guild'))

    return pipe(
      queue.update(List.append(track)),
      IO.chain(() => state.get),
      IO.chain(s => {
        switch (s.type) {
          case 'Disconnected':
            return connect(channel)

          case 'Connecting':
            return IO.unit // TODO: this shouldn't happen very often, but should we handle it?

          case 'Connected':
            return IO.left(Error('TODO'))
        }
      }),
    )
  }

  function connect(channel: MyChannel): IO<void> {
    const { observable, subject } = PubSub<MusicEvent>()

    const voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    })

    const connectionPub = PubSubUtils.publishOn<VoiceConnectionEvents, MusicEvent>(
      voiceConnection,
      subject.next,
    )
    const connectionPublish = apply.sequenceT(IO.ApplyPar)(
      connectionPub('error', MusicEvent.ConnectionError),
      connectionPub(VoiceConnectionStatus.Signalling, MusicEvent.ConnectionSignalling),
      connectionPub(VoiceConnectionStatus.Connecting, MusicEvent.ConnectionConnecting),
      connectionPub(VoiceConnectionStatus.Ready, MusicEvent.ConnectionReady),
      connectionPub(VoiceConnectionStatus.Disconnected, MusicEvent.ConnectionDisconnected),
      connectionPub(VoiceConnectionStatus.Destroyed, MusicEvent.ConnectionDestroyed),
    )

    const audioPlayer = createAudioPlayer()

    const playerPub = PubSubUtils.publishOn<AudioPlayerEvents, MusicEvent>(
      audioPlayer,
      subject.next,
    )
    const playerPublish = apply.sequenceT(IO.ApplyPar)(playerPub('error', MusicEvent.PlayerError))

    const sub = PubSubUtils.subscribe(logger, observable)
    const subscribe = sub(observer(), or(refinement.id()))

    return sequenceTPar(
      connectionPublish,
      playerPublish,
      subscribe,
      state.set(MusicState.Connecting(channel, voiceConnection, audioPlayer)),
    )
  }

  function observer(): TObserver<MusicEvent> {
    return {
      next: flow(event => {
        switch (event.type) {
          case 'ConnectionError':
          case 'PlayerError':
            return logger.warn(event.type, event.error)

          case 'ConnectionReady':
            return onConnectionReady()

          case 'ConnectionSignalling':
          case 'ConnectionConnecting':
          case 'ConnectionDisconnected':
          case 'ConnectionDestroyed':
            return onConnectionStateChange(event)
        }
      }, Future.fromIOEither),
    }
  }

  function onConnectionReady(): IO<void> {
    return pipe(
      state.get,
      IO.chain(s => {
        switch (s.type) {
          case 'Disconnected':
          case 'Connected':
            return logger.warn(`Inconsistent state: onConnectionReady while state was ${s.type}`)

          case 'Connecting':
            return pipe(
              IO.Do,
              IO.bind('subscription', () =>
                DiscordConnector.connectionSubscribe(s.voiceConnection, s.audioPlayer),
              ),
              IO.bind('connected', ({ subscription }) =>
                IO.right(MusicState.Connected(s.audioPlayer, subscription)),
              ),
              IO.chainFirst(({ connected }) => state.set(connected)),
              IO.chain(({ subscription, connected }) =>
                pipe(
                  subscription,
                  Maybe.fold(
                    () => logger.error('Subscription failed'),
                    () => playSongFromState(connected),
                  ),
                ),
              ),
            )
        }
      }),
    )
  }

  function playSongFromState({ audioPlayer }: MusicStateConnected): IO<void> {
    return pipe(
      queue.get,
      IO.chain(
        List.matchLeft(
          () =>
            // TODO: disconnect? Or maybe in onConnectionReady?
            IO.unit,
          head => DiscordConnector.playerPlayArbitrary(audioPlayer, head),
        ),
      ),
    )
  }

  function onConnectionStateChange({
    type,
    oldState,
    newState,
  }:
    | MusicEventConnectionSignalling
    | MusicEventConnectionConnecting
    | MusicEventConnectionReady
    | MusicEventConnectionDisconnected
    | MusicEventConnectionDestroyed): IO<void> {
    return logger.debug(`✉️  ${type} ${oldState.status} > ${newState.status}`)
  }

  function stringify(): string {
    return `<MusicSubscription[${guild.name}]>`
  }
}

const sequenceTPar = flow(
  apply.sequenceT(IO.ApplyPar),
  IO.map(() => {}),
)
