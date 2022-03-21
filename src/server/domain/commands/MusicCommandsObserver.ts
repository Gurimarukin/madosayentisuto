import { SlashCommandBuilder } from '@discordjs/builders'
import type {
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  StageChannel,
  TextBasedChannel,
  VoiceChannel,
} from 'discord.js'
import { GuildMember } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { StringUtils } from '../../../shared/utils/StringUtils'
import { Either, NonEmptyArray, toUnit } from '../../../shared/utils/fp'
import { Future, Maybe } from '../../../shared/utils/fp'

import { DiscordConnector, isUnknownMessageError } from '../../helpers/DiscordConnector'
import type { MusicSubscription } from '../../helpers/MusicSubscription'
import type { YtDlp } from '../../helpers/YtDlp'
import { musicStateButtons } from '../../helpers/messages/musicStateMessage'
import type { MadEventInteractionCreate } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { MusicState } from '../../models/music/MusicState'
import { Track } from '../../models/music/Track'
import type { TObserver } from '../../models/rx/TObserver'
import type { GuildStateService } from '../../services/GuildStateService'

type PlayCommand = {
  readonly musicChannel: VoiceChannel | StageChannel
  readonly stateChannel: TextBasedChannel
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
  ytDlp: YtDlp,
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
          case musicStateButtons.playPauseId:
            return onPlayPauseButton(interaction)
          case musicStateButtons.nextId:
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
      Future.Do,
      Future.chainFirst(() =>
        DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      ),
      Future.apS('subscription', guildStateService.getSubscription(guild)),
      Future.bind('command', ({ subscription }) => validatePlayCommand(interaction, subscription)),
      Future.chain(({ subscription, command }) =>
        pipe(
          command,
          Either.fold(Future.right, ({ musicChannel, stateChannel, tracks }) =>
            pipe(
              subscription.queueTracks(interaction.user, musicChannel, stateChannel, tracks),
              Future.map(() => tracksAddedInteractionReply(tracks)),
            ),
          ),
        ),
      ),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(toUnit),
    )
  }

  function onPlayPauseButton(interaction: ButtonInteraction): Future<void> {
    return buttonCommon(interaction, subscription => subscription.playPauseTrack())
  }

  function onNextButton(interaction: ButtonInteraction): Future<void> {
    return buttonCommon(interaction, subscription => subscription.nextTrack(interaction.user))
  }

  function validatePlayCommand(
    interaction: CommandInteraction,
    subscription: MusicSubscription,
  ): Future<Either<string, PlayCommand>> {
    return pipe(
      subscription.getState,
      Future.fromIOEither,
      Future.chain(subscriptionState =>
        pipe(
          validateMusicAndStateChannel(interaction, subscriptionState),
          Either.fold(flow(Either.left, Future.right), ({ musicChannel, stateChannel }) =>
            pipe(
              validateUrlThenTracks(interaction),
              Future.map(Either.map(tracks => ({ musicChannel, stateChannel, tracks }))),
            ),
          ),
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
      ytDlp.metadata(url),
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
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(guild)),
      Future.bind('subscriptionState', ({ subscription }) =>
        Future.fromIOEither(subscription.getState),
      ),
      Future.chain(({ subscription, subscriptionState }) =>
        pipe(
          validateMusicChannel(interaction, subscriptionState),
          Either.fold(flow(Either.left, Future.right), () =>
            pipe(
              f(subscription),
              Future.map(success =>
                success ? Either.right(undefined) : Either.left('Haha ! Tu ne peux pas faire ça !'),
              ),
            ),
          ),
          Future.chain(
            Either.fold(
              content =>
                DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
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
        ),
      ),
    )
  }
}

const validateMusicAndStateChannel = (
  interaction: Interaction,
  subscriptionState: MusicState,
): Either<string, Pick<PlayCommand, 'musicChannel' | 'stateChannel'>> =>
  pipe(
    validateMusicChannel(interaction, subscriptionState),
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
  subscriptionState: MusicState,
): Either<string, VoiceChannel | StageChannel> =>
  pipe(
    interaction.member instanceof GuildMember
      ? Maybe.fromNullable(interaction.member.voice.channel)
      : Maybe.none,
    Either.fromOption(() => 'Haha ! Il faut être dans un salon vocal pour faire ça !'),
    Either.filterOrElse(
      musicChannel =>
        pipe(
          subscriptionState,
          MusicState.getChannel,
          Maybe.every(c => c.id === musicChannel.id),
        ),
      () => 'Haha ! Il faut être dans mon salon pour faire ça !',
    ),
  )

const tracksAddedInteractionReply = (tracks: NonEmptyArray<Track>): string =>
  pipe(
    tracks,
    NonEmptyArray.map(t => `"${t.title}"`),
    StringUtils.mkString('', ', ', ` ajouté${tracks.length === 1 ? '' : 's'} à la file d'attente.`),
  )
