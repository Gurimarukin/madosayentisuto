import {
  AudioPlayerStatus,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice'
import { StageChannel, VoiceChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { DbReady, PublicCallStarted } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { createDiscordAdapter } from '../../utils/createDiscordAdapter'
import { Future, IO } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { PartialLogger } from '../Logger'

export const MusicObserver = (Logger: PartialLogger): TObserver<DbReady | PublicCallStarted> => {
  const logger = Logger('MusicObserver')
  const player = createAudioPlayer()

  return {
    next: event => {
      switch (event.type) {
        case 'DbReady':
          return playSong()

        case 'PublicCallStarted':
          return pipe(
            connectToChannel(event.channel),
            Future.map(connection => connection.subscribe(player)),
            Future.chain(() =>
              Future.fromIOEither(
                LogUtils.withGuild(logger, 'debug', event.channel.guild)('Playing now'),
              ),
            ),
          )
      }
    },
  }

  function playSong(): Future<void> {
    const resource = createAudioResource('https://dl.blbl.ch/champion_select.mp3', {
      inputType: StreamType.Arbitrary,
    })

    return pipe(
      IO.tryCatch(() => player.play(resource)),
      Future.fromIOEither,
      Future.chain(() =>
        Future.tryCatch(() => entersState(player, AudioPlayerStatus.Playing, 5e3)),
      ),
      Future.map(() => {}),
    )
  }

  function connectToChannel(channel: VoiceChannel | StageChannel): Future<VoiceConnection> {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: createDiscordAdapter(channel),
    })

    return pipe(
      Future.tryCatch(() => entersState(connection, VoiceConnectionStatus.Ready, 30e3)),
      Future.map(() => connection),
      Future.recover(error =>
        pipe(
          IO.tryCatch(() => connection.destroy()),
          Future.fromIOEither,
          Future.chain(() => Future.left(error)),
        ),
      ),
    )
  }
}
