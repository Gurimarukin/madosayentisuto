import { SlashCommandBuilder } from '@discordjs/builders'
import type {
  ButtonInteraction,
  CommandInteraction,
  Guild,
  Interaction,
  StageChannel,
  TextBasedChannels,
  VoiceChannel,
} from 'discord.js'
import { GuildMember } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { Either, NonEmptyArray } from '../../../shared/utils/fp'
import { Future, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector, isUnknownMessageError } from '../../helpers/DiscordConnector'
import type { YoutubeDl } from '../../helpers/YoutubeDl'
import { musicButtons } from '../../helpers/getMusicStateMessage'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { Track } from '../../models/music/Track'
import type { TObserver } from '../../models/rx/TObserver'
import type { GuildStateService } from '../../services/GuildStateService'
import { StringUtils } from '../../utils/StringUtils'

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

export type MusicCommandsObserver = TObserver<MadEventInteractionCreate> & {
  readonly validateTrack: (url: string) => Future<Either<string, NonEmptyArray<Track>>>
}

export const MusicCommandsObserver = (
  Logger: LoggerGetter,
  youtubeDl: YoutubeDl,
  guildStateService: GuildStateService,
): MusicCommandsObserver => {
  const logger = Logger('MusicCommandsObserver')

  return {
    next: event => {
      const interaction = event.interaction
      const guild = interaction.guild

      if (guild === null) return Future.unit

      if (interaction.isCommand()) {
        switch (interaction.commandName) {
          case 'play':
            return onPlayCommand(interaction, guild)
        }
      }

      if (interaction.isButton()) {
        switch (interaction.customId) {
          case musicButtons.playPauseId:
            return onPlayPauseButton(interaction)
          case musicButtons.nextId:
            return onNextButton(interaction, guild)
        }
      }

      return Future.unit
    },
    validateTrack,
  }

  function onPlayCommand(interaction: CommandInteraction, guild: Guild): Future<void> {
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
  }

  function onPlayPauseButton(interaction: ButtonInteraction): Future<void> {
    return buttonCommon(interaction, Future.right(Either.right(undefined))) // TODO
  }

  function onNextButton(interaction: ButtonInteraction, guild: Guild): Future<void> {
    return buttonCommon(
      interaction,
      pipe(
        guildStateService.getSubscription(guild),
        Future.chain(subscription => subscription.nextTrack()),
        Future.map(
          (success): Either<string, void> =>
            success ? Either.right(undefined) : Either.left('Haha ! Tu ne peux pas faire ça !'),
        ),
      ),
    )
  }

  function validatePlayCommand(
    interaction: CommandInteraction,
  ): Future<Either<string, ValidatedPlayCommand>> {
    // TODO: split this function
    return pipe(
      validateVoiceChannel(interaction),
      Either.fold(flow(Either.left, Future.right), musicChannel =>
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
                        logger.warn(`validateTrack Error:\n${e.stack}`),
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

  function buttonCommon(
    interaction: ButtonInteraction,
    f: Future<Either<string, void>>,
  ): Future<void> {
    return pipe(
      validateVoiceChannel(interaction),
      Either.fold(flow(Either.left, Future.right), () => f),
      Future.chain(
        Either.fold(
          content => DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
          () =>
            pipe(
              DiscordConnector.interactionUpdate(interaction),
              Future.orElse(e =>
                isUnknownMessageError(e)
                  ? Future.unit // maybe it was deleted before we can update the interaction)
                  : Future.left(e),
              ),
            ),
        ),
      ),
    )
  }

  function validateTrack(url: string): Future<Either<string, NonEmptyArray<Track>>> {
    return pipe(
      youtubeDl.metadata(url),
      Future.map(({ videos }) =>
        pipe(
          videos,
          NonEmptyArray.map(v => Track.of(v.title, v.webpage_url, v.thumbnail)),
          Either.right,
        ),
      ),
    )
  }
}

const validateVoiceChannel = (
  interaction: Interaction,
): Either<string, VoiceChannel | StageChannel> =>
  pipe(
    interaction.member instanceof GuildMember
      ? Maybe.fromNullable(interaction.member.voice.channel)
      : Maybe.none,
    Either.fromOption(() => 'Haha ! Il faut être dans un salon vocal pour faire ça !'),
  )
