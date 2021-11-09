import { SlashCommandBuilder } from '@discordjs/builders'
import { VoiceConnectionStatus, joinVoiceChannel } from '@discordjs/voice'
import { CommandInteraction, Guild, GuildMember } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { MusicSubscription } from '../../../models/guildState/MusicSubscription'
import { InteractionCreate } from '../../../models/MadEvent'
import { MsDuration } from '../../../models/MsDuration'
import { TObserver } from '../../../models/TObserver'
import { Future, Maybe } from '../../../utils/fp'
import { DiscordConnector } from '../../DiscordConnector'
import { GuildStateService } from '../../GuildStateService'

export const musicObserverCommand = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Jean Plank joue un petit air')

export const MusicObserver = (
  guildStateService: GuildStateService,
): TObserver<InteractionCreate> => {
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
        Future.chain(
          Maybe.fold(
            () => createSubscriptionIfVoiceChannel(guild, interaction),
            flow(Maybe.some, Future.right),
          ),
        ),
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
            subscription => {
              const res = pipe(
                DiscordConnector.entersState(
                  subscription.voiceConnection,
                  VoiceConnectionStatus.Ready,
                  MsDuration.seconds(20),
                ),
                Future.orElseFirst(() =>
                  DiscordConnector.interactionFollowUp(
                    interaction,
                    'Failed to join voice channel within 20 seconds, please try again later!',
                  ),
                ),
              )

              console.log('subscription =', subscription, res)
              return Future.error('TODO - some')
            },
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
    const subscription = MusicSubscription.fromVoiceConnection(
      joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      }),
    )
    // subscription.voiceConnection.on('error', console.warn)
    return pipe(
      guildStateService.setSubscription(guild, subscription),
      Future.fromIOEither,
      Future.map(() => Maybe.some(subscription)),
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
