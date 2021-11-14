import { SlashCommandBuilder } from '@discordjs/builders'
import type { CommandInteraction, Guild } from 'discord.js'
import { GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { Future, IO, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { MusicSubscription } from '../../helpers/music/MusicSubscription'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { TObserver } from '../../models/rx/TObserver'
import type { GuildStateService } from '../../services/GuildStateService'

export const playCommand = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Jean Plank joue un petit air')

export const MusicCommandsObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventInteractionCreate> => {
  return {
    next: event => {
      const interaction = event.interaction
      const guild = interaction.guild

      if (!interaction.isCommand() || interaction.commandName !== 'play' || guild === null) {
        return Future.unit
      }

      return pipe(
        DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
        Future.map(() => guildStateService.getSubscription(guild)),
        Future.chain(Future.fromIOEither),
        futureMaybe.alt(() => createSubscriptionIfVoiceChannel(guild, interaction)),
        Future.chain(
          Maybe.fold(
            () =>
              pipe(
                DiscordConnector.interactionFollowUp(interaction, {
                  content: 'Join a voice channel and then try that again!',
                  ephemeral: true,
                }),
                Future.map(() => {}),
              ),
            subscription =>
              pipe(
                subscription.playSong(),
                Future.fromIOEither,
                Future.chain(() =>
                  DiscordConnector.interactionFollowUp(interaction, 'Playing song.'),
                ),
                Future.map(() => {}),
              ),
          ),
        ),
      )
    },
  }

  function createSubscriptionIfVoiceChannel(
    guild: Guild,
    interaction: CommandInteraction,
  ): Future<Maybe<MusicSubscription>> {
    if (!(interaction.member instanceof GuildMember) || interaction.member.voice.channel === null) {
      return Future.right(Maybe.none)
    }

    const channel = interaction.member.voice.channel

    return pipe(
      MusicSubscription(Logger, channel),
      IO.chainFirst(subscription => guildStateService.setSubscription(guild, subscription)),
      Future.fromIOEither,
      Future.map(Maybe.some),
    )
  }
}

// function playSong(): Future<void> {
//   const resource = createAudioResource('https://dl.blbl.ch/champion_select.mp3', {
//     inputType: StreamType.Arbitrary,
//   })

//   return pipe(
//     IO.tryCatch(() => player.play(resource)),
//     Future.fromIOEither,
//     Future.chain(() =>
//       Future.tryCatch(() => entersState(player, AudioPlayerStatus.Playing, 5e3)),
//     ),
//     Future.map(() => {}),
//   )
// }

// function connectToChannel(channel: VoiceChannel | StageChannel): Future<VoiceConnection> {
//   const connection = joinVoiceChannel({
//     channelId: channel.id,
//     guildId: channel.guild.id,
//     adapterCreator: channel.guild.voiceAdapterCreator,
//   })

//   return pipe(
//     Future.tryCatch(() => entersState(connection, VoiceConnectionStatus.Ready, 30e3)),
//     Future.map(() => connection),
//     Future.orElse(error =>
//       pipe(
//         IO.tryCatch(() => connection.destroy()),
//         Future.fromIOEither,
//         Future.chain(() => Future.left(error)),
//       ),
//     ),
//   )
// }
