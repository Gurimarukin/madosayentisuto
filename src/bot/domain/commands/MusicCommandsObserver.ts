import { SlashCommandBuilder } from '@discordjs/builders'
import type { CommandInteraction, StageChannel, VoiceChannel } from 'discord.js'
import { GuildMember } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { Future, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { Track } from '../../models/music/Track'
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

      const track = Track.of(
        'He Looks Familiar...',
        'https://cdn.discordapp.com/attachments/849299103362973777/913098049407037500/he_looks_familiar....mp3',
        // Maybe.some('https://i.ytimg.com/vi/aeWfN6CinGY/hq720.jpg'),
      )
      return pipe(
        DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
        Future.chain(() =>
          apply.sequenceS(futureMaybe.ApplyPar)({
            musicChannel: Future.right(maybeVoiceChannel(interaction)),
            stateChannel: futureMaybe.fromNullable(interaction.channel),
            subscription: pipe(guildStateService.getSubscription(guild), Future.map(Maybe.some)),
          }),
        ),
        futureMaybe.chainFuture(({ musicChannel, stateChannel, subscription }) =>
          subscription.playTrack(musicChannel, stateChannel, track),
        ),
        futureMaybe.matchE(
          () =>
            DiscordConnector.interactionFollowUp(interaction, {
              content: 'Join a voice channel and then try that again!',
              ephemeral: true,
            }),
          () => DiscordConnector.interactionFollowUp(interaction, 'Playing song.'),
        ),
        Future.map(() => {}),
      )
    },
  }

  function maybeVoiceChannel(interaction: CommandInteraction): Maybe<VoiceChannel | StageChannel> {
    return interaction.member instanceof GuildMember
      ? Maybe.fromNullable(interaction.member.voice.channel)
      : Maybe.none
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
