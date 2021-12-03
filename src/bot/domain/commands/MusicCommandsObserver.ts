import { SlashCommandBuilder } from '@discordjs/builders'
import type {
  ButtonInteraction,
  CommandInteraction,
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
import type { MusicSubscription } from '../../helpers/music/MusicSubscription'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { Track } from '../../models/music/Track'
import type { TObserver } from '../../models/rx/TObserver'
import type { GuildStateService } from '../../services/GuildStateService'
import { StringUtils } from '../../utils/StringUtils'

type PlayCommand = {
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
  readonly validateTracks: (url: string) => Future<Either<string, NonEmptyArray<Track>>>
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

      if (interaction.isCommand()) {
        switch (interaction.commandName) {
          case 'play':
            return onPlayCommand(interaction)
        }
      }

      if (interaction.isButton()) {
        switch (interaction.customId) {
          case musicButtons.playPauseId:
            return onPlayPauseButton(interaction)
          case musicButtons.nextId:
            return onNextButton(interaction)
        }
      }

      return Future.unit
    },
    validateTracks,
  }

  function onPlayCommand(interaction: CommandInteraction): Future<void> {
    const guild = interaction.guild
    if (guild === null) return Future.unit
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.chain(() => validatePlayCommand(interaction)),
      Future.chain(
        Either.fold(Future.right, ({ musicChannel, stateChannel, tracks }) =>
          pipe(
            guildStateService.getSubscription(guild),
            Future.chain(subscription =>
              subscription.queueTracks(musicChannel, stateChannel, tracks),
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
    return buttonCommon(interaction, subscription => subscription.playPauseTrack())
  }

  function onNextButton(interaction: ButtonInteraction): Future<void> {
    return buttonCommon(interaction, subscription => subscription.nextTrack())
  }

  function validatePlayCommand(
    interaction: CommandInteraction,
  ): Future<Either<string, PlayCommand>> {
    return pipe(
      validateMusicAndStateChannel(interaction),
      Either.fold(flow(Either.left, Future.right), ({ musicChannel, stateChannel }) =>
        pipe(
          validateUrlThenTracks(interaction),
          Future.map(Either.map(tracks => ({ musicChannel, stateChannel, tracks }))),
        ),
      ),
    )
  }

  function validateUrlThenTracks(
    interaction: CommandInteraction,
  ): Future<Either<string, NonEmptyArray<Track>>> {
    return pipe(
      interaction.options.getString('url'),
      Maybe.fromNullable,
      Maybe.fold(
        () => Future.right(Either.left('Argument manquant : url')),
        flow(
          validateTracks,
          Future.orElse(e =>
            pipe(
              logger.warn(`validateTrack Error:\n${e.stack}`),
              Future.fromIOEither,
              Future.map(() => Either.left('URL invalide.')),
            ),
          ),
        ),
      ),
    )
  }

  function validateTracks(url: string): Future<Either<string, NonEmptyArray<Track>>> {
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

  function buttonCommon(
    interaction: ButtonInteraction,
    f: (suscription: MusicSubscription) => Future<boolean>,
  ): Future<void> {
    const guild = interaction.guild
    if (guild === null) return Future.unit
    return pipe(
      validateMusicChannel(interaction),
      Either.fold(flow(Either.left, Future.right), () =>
        pipe(
          guildStateService.getSubscription(guild),
          Future.chain(f),
          Future.map(success =>
            success ? Either.right(undefined) : Either.left('Haha ! Tu ne peux pas faire ça !'),
          ),
        ),
      ),
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
}

const validateMusicAndStateChannel = (
  interaction: Interaction,
): Either<string, Pick<PlayCommand, 'musicChannel' | 'stateChannel'>> =>
  pipe(
    validateMusicChannel(interaction),
    Either.chain(musicChannel =>
      pipe(
        interaction.channel,
        Either.fromNullable(
          "Alors ça, c'est chelou : comment peut-on faire une interaction sans salon ?",
        ),
        Either.map(stateChannel => ({ musicChannel, stateChannel })),
      ),
    ),
  )

const validateMusicChannel = (
  interaction: Interaction,
): Either<string, VoiceChannel | StageChannel> =>
  pipe(
    interaction.member instanceof GuildMember
      ? Maybe.fromNullable(interaction.member.voice.channel)
      : Maybe.none,
    Either.fromOption(() => 'Haha ! Il faut être dans un salon vocal pour faire ça !'),
  )
