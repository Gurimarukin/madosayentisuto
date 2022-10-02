import type { ButtonInteraction, ChatInputCommandInteraction, Interaction } from 'discord.js'
import { GuildMember } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { Either, List, NonEmptyArray, toUnit } from '../../../shared/utils/fp'
import { Future, Maybe } from '../../../shared/utils/fp'

import type { AudioSubscription } from '../../helpers/AudioSubscription'
import { DiscordConnector, isUnknownMessageError } from '../../helpers/DiscordConnector'
import type { YtDlp } from '../../helpers/YtDlp'
import { MusicStateMessage, musicStateButtons } from '../../helpers/messages/MusicStateMessage'
import { AudioState } from '../../models/audio/AudioState'
import { Track } from '../../models/audio/music/Track'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import type { GuildStateService } from '../../services/GuildStateService'
import type { GuildAudioChannel, GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'

type PlayCommand = {
  readonly musicChannel: GuildAudioChannel
  readonly stateChannel: GuildSendableChannel
  readonly tracks: NonEmptyArray<Track>
}

const playCommand = Command.chatInput({
  name: MusicStateMessage.Keys.play,
  description: 'Jean Plank joue un petit air',
})(
  Command.option.string({
    name: MusicStateMessage.Keys.track,
    description: 'Lien ou recherche YouTube, lien Bandcamp, fichier, etc.',
    required: true,
  }),
)

export const musicCommands = [playCommand]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MusicCommandsObserver = (
  Logger: LoggerGetter,
  ytDlp: YtDlp,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('MusicCommandsObserver')

  return {
    ...ObserverWithRefinement.fromNext(
      MadEvent,
      'InteractionCreate',
    )(({ interaction }) => {
      if (interaction.isChatInputCommand()) return onChatInputCommand(interaction)
      if (interaction.isButton()) return onButton(interaction)
      return Future.unit
    }),

    validateTracks,
  }

  function onChatInputCommand(interaction: ChatInputCommandInteraction): Future<void> {
    switch (interaction.commandName) {
      case MusicStateMessage.Keys.play:
        return onPlayCommand(interaction)
    }
    return Future.unit
  }

  function onPlayCommand(interaction: ChatInputCommandInteraction): Future<void> {
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

  function onButton(interaction: ButtonInteraction): Future<void> {
    switch (interaction.customId) {
      case musicStateButtons.playPauseId:
        return onPlayPauseButton(interaction)
      case musicStateButtons.nextId:
        return onNextButton(interaction)
    }
    return Future.unit
  }

  function onPlayPauseButton(interaction: ButtonInteraction): Future<void> {
    return buttonCommon(interaction, subscription => subscription.playPauseTrack())
  }

  function onNextButton(interaction: ButtonInteraction): Future<void> {
    return buttonCommon(interaction, subscription => subscription.playNextTrack(interaction.user))
  }

  function validatePlayCommand(
    interaction: ChatInputCommandInteraction,
    subscription: AudioSubscription,
  ): Future<Either<string, PlayCommand>> {
    return pipe(
      subscription.getState,
      Future.fromIO,
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
    interaction: ChatInputCommandInteraction,
  ): Future<Either<string, NonEmptyArray<Track>>> {
    return pipe(
      interaction.options.getString(MusicStateMessage.Keys.track),
      Maybe.fromNullable,
      Maybe.fold(
        () => Future.right(Either.left(`Argument manquant : ${MusicStateMessage.Keys.track}`)),
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
    f: (suscription: AudioSubscription) => Future<boolean>,
  ): Future<void> {
    const guild = interaction.guild
    if (guild === null) return Future.unit
    return pipe(
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(guild)),
      Future.bind('subscriptionState', ({ subscription }) => Future.fromIO(subscription.getState)),
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
  subscriptionState: AudioState,
): Either<string, Pick<PlayCommand, 'musicChannel' | 'stateChannel'>> =>
  pipe(
    validateMusicChannel(interaction, subscriptionState),
    Either.chain(musicChannel =>
      pipe(
        Maybe.fromNullable(interaction.channel),
        Maybe.filter(ChannelUtils.isGuildSendable),
        Either.fromOption(
          () => "Alors ça, c'est chelou : comment peut-on faire une interaction sans salon ?",
        ),
        Either.map(stateChannel => ({ musicChannel, stateChannel })),
      ),
    ),
  )

const validateMusicChannel = (
  interaction: Interaction,
  subscriptionState: AudioState,
): Either<string, GuildAudioChannel> =>
  pipe(
    interaction.member instanceof GuildMember
      ? Maybe.fromNullable(interaction.member.voice.channel)
      : Maybe.none,
    Either.fromOption(() => 'Haha ! Il faut être dans un salon vocal pour faire ça !'),
    Either.filterOrElse(
      musicChannel =>
        pipe(
          subscriptionState,
          AudioState.getChannel,
          Maybe.every(c => c.id === musicChannel.id),
        ),
      () => 'Haha ! Il faut être dans mon salon pour faire ça !',
    ),
  )

const tracksAddedInteractionReply = (tracks: NonEmptyArray<Track>): string =>
  pipe(
    tracks,
    NonEmptyArray.map(t => `"${t.title}"`),
    List.mkString('', ', ', ` ajouté${tracks.length === 1 ? '' : 's'} à la file d'attente.`),
  )
