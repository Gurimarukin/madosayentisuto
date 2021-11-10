import type { VoiceConnectionEvents } from '@discordjs/voice'
import { VoiceConnectionStatus } from '@discordjs/voice'
import { createAudioPlayer, joinVoiceChannel } from '@discordjs/voice'
import type { StageChannel, VoiceChannel } from 'discord.js'
import { apply, refinement } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Future, IO } from '../../../shared/utils/fp'

import { MusicEvent } from '../../models/events/MusicEvent'
import type { LoggerGetter, LoggerType } from '../../models/logger/LoggerType'
import { PubSub } from '../../models/rx/PubSub'
import type { TObservable } from '../../models/rx/TObservable'
import type { TObserver } from '../../models/rx/TObserver'
import type { TSubject } from '../../models/rx/TSubject'
import { PubSubUtils } from '../../utils/PubSubUtils'

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
  const audioPlayer = createAudioPlayer()

  const pub = PubSubUtils.publishOn<VoiceConnectionEvents, MusicEvent>(
    voiceConnection,
    subject.next,
  )
  const publish = apply.sequenceT(IO.ApplyPar)(
    pub('error', MusicEvent.MusicError),
    pub(VoiceConnectionStatus.Ready, MusicEvent.VoiceConnectionReady),
  )

  const sub = PubSubUtils.subscribe(logger, observable)
  const subscribe = sub(observer(logger), or(refinement.id()))

  return pipe(
    apply.sequenceT(IO.ApplyPar)(publish, subscribe),
    IO.map(() => ({ observable, subject, playSong })),
  )

  function playSong(): IO<void> {
    return logger.debug('playSong')
  }
}

const observer = (logger: LoggerType): TObserver<MusicEvent> => ({
  next: event => {
    switch (event.type) {
      case 'MusicError':
        return pipe(logger.warn(event.error), Future.fromIOEither)

      case 'VoiceConnectionReady':
        console.log('ready =', event.oldState, event.newState)
        return Future.unit
    }
  },
})
