import { SlashCommandBuilder } from '@discordjs/builders'
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

import { InteractionCreate } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Future, IO, todo } from '../../../utils/fp'
import { GuildStateService } from '../../GuildStateService'
import { PartialLogger } from '../../Logger'

export const musicObserverCommand = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Jean Plank joue un petit air')

export const MusicObserver = (
  Logger: PartialLogger,
  guildStateService: GuildStateService,
): TObserver<InteractionCreate> => {
  const logger = Logger('MusicObserver')
  const player = createAudioPlayer()

  return {
    next: event => {
      const interaction = event.interaction
      // const guild = interaction.guild

      // if (
      //   !interaction.isCommand() ||
      //   interaction.commandName !== musicObserverCommand.name ||
      //   guild === null
      // ) {
      //   return Future.unit
      // }

      // const res = pipe(
      //   DiscordConnector.deferReply(interaction),
      //   Future.chain(() => guildStateService.getSubscription(guild)),
      //   Future.chain()
      // )

      return Future.unit
      // return todo(guildStateService, logger, interaction, playSong, connectToChannel)
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
      adapterCreator: channel.guild.voiceAdapterCreator,
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
