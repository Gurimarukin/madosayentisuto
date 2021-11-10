import type { AudioPlayerEvents, PlayerSubscription, VoiceConnectionEvents } from '@discordjs/voice'
import { VoiceConnectionStatus } from '@discordjs/voice'
import { createAudioPlayer, joinVoiceChannel } from '@discordjs/voice'
import type { StageChannel, VoiceChannel } from 'discord.js'
import { apply, refinement } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Future, IO, Maybe } from '../../../shared/utils/fp'

import { Store } from '../../models/Store'
import { MusicEvent } from '../../models/events/MusicEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { PubSub } from '../../models/rx/PubSub'
import type { TObservable } from '../../models/rx/TObservable'
import type { TObserver } from '../../models/rx/TObserver'
import type { TSubject } from '../../models/rx/TSubject'
import { PubSubUtils } from '../../utils/PubSubUtils'
import { DiscordConnector } from '../DiscordConnector'

const { or } = PubSubUtils

export type MusicSubscription = {
  readonly observable: TObservable<MusicEvent>
  readonly subject: TSubject<MusicEvent>
  readonly playSong: () => IO<void>
}

export const MusicSubscription = (
  Logger: LoggerGetter,
  channel: VoiceChannel | StageChannel,
): IO<MusicSubscription> => {
  const logger = Logger(`MusicSubscription-${channel.guild.id}`)

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
    connectionPub(VoiceConnectionStatus.Ready, MusicEvent.VoiceConnectionReady),
  )

  const audioPlayer = createAudioPlayer()

  const playerPub = PubSubUtils.publishOn<AudioPlayerEvents, MusicEvent>(audioPlayer, subject.next)
  const playerPublish = apply.sequenceT(IO.ApplyPar)(playerPub('error', MusicEvent.PlayerError))

  const subscriptionStore = Store<Maybe<PlayerSubscription>>(Maybe.none)

  const sub = PubSubUtils.subscribe(logger, observable)
  const subscribe = sub(observer(), or(refinement.id()))

  return pipe(
    apply.sequenceT(IO.ApplyPar)(connectionPublish, playerPublish, subscribe),
    IO.map(() => ({ observable, subject, playSong })),
  )

  function playSong(): IO<void> {
    return logger.debug('playSong')
  }

  function observer(): TObserver<MusicEvent> {
    return {
      next: event => {
        switch (event.type) {
          case 'ConnectionError':
          case 'PlayerError':
            return Future.fromIOEither(logger.warn(event.type, event.error))

          case 'VoiceConnectionReady':
            return onVoiceConnectionReady()
        }
      },
    }
  }

  function onVoiceConnectionReady(): Future<void> {
    return pipe(
      DiscordConnector.connectionSubscribe(voiceConnection, audioPlayer),
      IO.chainFirst(subscriptionStore.set),
      IO.chain(
        Maybe.fold(
          () => logger.warn('Subscription failed'),
          () =>
            DiscordConnector.playerPlayArbitrary(
              audioPlayer,
              'https://dl.blbl.ch/champion_select.mp3',
            ),
        ),
      ),
      Future.fromIOEither,
    )
  }
}
