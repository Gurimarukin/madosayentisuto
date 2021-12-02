import { SlashCommandBuilder } from '@discordjs/builders'
import type { CommandInteraction, StageChannel, TextBasedChannels, VoiceChannel } from 'discord.js'
import { GuildMember } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { Either, NonEmptyArray } from '../../../shared/utils/fp'
import { Future, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { Track } from '../../models/music/Track'
import type { TObserver } from '../../models/rx/TObserver'
import type { GuildStateService } from '../../services/GuildStateService'
import { StringUtils } from '../../utils/StringUtils'
import { YtUtils } from '../../utils/YtUtils'

type ValidatedPlayCommand = {
  readonly musicChannel: VoiceChannel | StageChannel
  readonly stateChannel: TextBasedChannels
  readonly tracks: NonEmptyArray<Track>
}

export const playCommand = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Jean Plank joue un petit air')
  .addStringOption(option =>
    option.setName('url').setDescription('Lien YouTube, Bandcamp, fichier, ...').setRequired(true),
  )

export const MusicCommandsObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventInteractionCreate> => {
  const logger = Logger('MusicCommandsObserver')

  return {
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
          Either.fold(Future.right, ({ musicChannel, stateChannel, tracks }) =>
            pipe(
              guildStateService.getSubscription(guild),
              Future.chain(subscription =>
                subscription.playTracks(musicChannel, stateChannel, tracks),
              ),
              Future.map(() =>
                pipe(
                  tracks,
                  NonEmptyArray.map(t => `"${t.title}"`),
                  StringUtils.mkString(
                    '',
                    ', ',
                    ` ajouté${tracks.length === 1 ? '' : 's'} à la file d'attente.`,
                  ),
                ),
              ),
            ),
          ),
        ),
        Future.chain(content =>
          DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
        ),
        Future.map(() => {}),
      )
    },
  }

  function validatePlayCommand(
    interaction: CommandInteraction,
  ): Future<Either<string, ValidatedPlayCommand>> {
    return pipe(
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
                    "Alors ça, c'est chelou : comment peut-on faire une interaction sans salon ?",
                  ),
                ),
              stateChannel =>
                pipe(
                  interaction.options.getString('url'),
                  Maybe.fromNullable,
                  Maybe.fold(
                    () => Future.right(Either.left('Argument manquant : url')),
                    flow(
                      validateTrack,
                      Future.orElse(e =>
                        pipe(
                          logger.warn(`validateTrack Error:\n${e.message}`),
                          Future.fromIOEither,
                          Future.map(() => Either.left('URL invalide.')),
                        ),
                      ),
                      Future.map(Either.map(tracks => ({ musicChannel, stateChannel, tracks }))),
                    ),
                  ),
                ),
            ),
          ),
      ),
    )
  }
}

const maybeVoiceChannel = (interaction: CommandInteraction): Maybe<VoiceChannel | StageChannel> =>
  interaction.member instanceof GuildMember
    ? Maybe.fromNullable(interaction.member.voice.channel)
    : Maybe.none

export const validateTrack = (url: string): Future<Either<string, NonEmptyArray<Track>>> =>
  pipe(
    YtUtils.metadata(url),
    Future.map(({ videos }) =>
      pipe(
        videos,
        NonEmptyArray.map(v => Track.of(v.title, v.webpage_url, v.thumbnail)),
        Either.right,
      ),
    ),
  )
