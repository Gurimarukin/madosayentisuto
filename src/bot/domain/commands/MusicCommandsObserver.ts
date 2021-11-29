import { SlashCommandBuilder } from '@discordjs/builders'
import type { CommandInteraction, StageChannel, TextBasedChannels, VoiceChannel } from 'discord.js'
import { GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { Either } from '../../../shared/utils/fp'
import { Future, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import { Track } from '../../models/music/Track'
import type { TObserver } from '../../models/rx/TObserver'
import type { GuildStateService } from '../../services/GuildStateService'

type ValidatedPlayCommand = {
  readonly musicChannel: VoiceChannel | StageChannel
  readonly stateChannel: TextBasedChannels
  readonly track: Track
}

export const playCommand = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Jean Plank joue un petit air')
  .addStringOption(option =>
    option.setName('url').setDescription('Lien YouTube, Bandcamp, fichier, ...').setRequired(true),
  )

export const MusicCommandsObserver = (
  guildStateService: GuildStateService,
): TObserver<MadEventInteractionCreate> => ({
  next: event => {
    const interaction = event.interaction
    const guild = interaction.guild

    if (!interaction.isCommand() || interaction.commandName !== 'play' || guild === null) {
      return Future.unit
    }

    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.chain(() => validatePlayCommand(interaction)),
      Future.chain(
        Either.fold(Future.right, ({ musicChannel, stateChannel, track }) =>
          pipe(
            guildStateService.getSubscription(guild),
            Future.chain(subscription => subscription.playTrack(musicChannel, stateChannel, track)),
            Future.map(() => `"${track.title}" ajouté à la file d'attente.`),
          ),
        ),
      ),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(() => {}),
    )
  },
})

const validatePlayCommand = (
  interaction: CommandInteraction,
): Future<Either<string, ValidatedPlayCommand>> =>
  pipe(
    maybeVoiceChannel(interaction),
    Maybe.fold(
      () => Future.right(Either.left('Haha ! Il faut être dans un salon vocal pour faire ça !')),
      musicChannel =>
        pipe(
          interaction.channel,
          Maybe.fromNullable,
          Maybe.fold(
            () =>
              Future.right(
                Either.left(
                  "Alors ça, c'est chelou : comment peut-on faire une interaction pas dans un salon ?",
                ),
              ),
            stateChannel =>
              pipe(
                validateTrack(Maybe.fromNullable(interaction.options.getString('url'))),
                Future.map(Either.map(track => ({ musicChannel, stateChannel, track }))),
              ),
          ),
        ),
    ),
  )

const maybeVoiceChannel = (interaction: CommandInteraction): Maybe<VoiceChannel | StageChannel> =>
  interaction.member instanceof GuildMember
    ? Maybe.fromNullable(interaction.member.voice.channel)
    : Maybe.none

const validateTrack = (url: Maybe<string>): Future<Either<string, Track>> =>
  // https://i.imgur.com/lBrj5I6.gifv
  Future.right(
    Either.right(
      Track.of(
        'He Looks Familiar...',
        'https://cdn.discordapp.com/attachments/849299103362973777/913098049407037500/he_looks_familiar....mp3',
        'https://i.ytimg.com/vi/aeWfN6CinGY/hq720.jpg',
        // 'https://f4.bcbits.com/img/a1386696993_10.jpg',
      ),
    ),
  )
