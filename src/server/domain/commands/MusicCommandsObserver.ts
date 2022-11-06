import type { ButtonInteraction, ChatInputCommandInteraction, Interaction } from 'discord.js'
import { GuildMember } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { Track } from '../../../shared/models/audio/music/Track'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Either, Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../../shared/utils/fp'

import type { AudioSubscription } from '../../helpers/AudioSubscription'
import { DiscordConnector, isUnknownMessageError } from '../../helpers/DiscordConnector'
import type { YtDlp } from '../../helpers/YtDlp'
import { MusicStateMessage } from '../../helpers/messages/MusicStateMessage'
import { AudioState } from '../../models/audio/AudioState'
import { AudioStateValue } from '../../models/audio/AudioStateValue'
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
      return Future.notUsed
    }),

    validateTracks,
  }

  function onChatInputCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    switch (interaction.commandName) {
      case MusicStateMessage.Keys.play:
        return onPlayCommand(interaction)
    }
    return Future.notUsed
  }

  function onPlayCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    const guild = interaction.guild
    if (guild === null) return Future.notUsed
    return pipe(
      Future.Do,
      Future.chainFirst(() =>
        DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      ),
      Future.apS('subscription', guildStateService.getSubscription(guild)),
      Future.bind('command', ({ subscription }) => validatePlayCommand(interaction, subscription)),
      Future.chainIOEitherK(({ subscription, command }) =>
        pipe(
          command,
          Either.fold(IO.right, ({ musicChannel, stateChannel, tracks }) =>
            pipe(
              subscription.queueTracks(interaction.user, musicChannel, stateChannel, tracks),
              IO.map(() => tracksAddedInteractionReply(tracks)),
            ),
          ),
        ),
      ),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(toNotUsed),
    )
  }

  function onButton(interaction: ButtonInteraction): Future<NotUsed> {
    switch (interaction.customId) {
      case MusicStateMessage.ButtonId.playPause:
        return onPlayPauseButton(interaction)
      case MusicStateMessage.ButtonId.next:
        return onNextButton(interaction)
    }
    return Future.notUsed
  }

  function onPlayPauseButton(interaction: ButtonInteraction): Future<NotUsed> {
    return buttonCommon(interaction, subscription => subscription.playPauseTrack)
  }

  function onNextButton(interaction: ButtonInteraction): Future<NotUsed> {
    return buttonCommon(interaction, subscription => subscription.playNextTrack(interaction.user))
  }

  function validatePlayCommand(
    interaction: ChatInputCommandInteraction,
    subscription: AudioSubscription,
  ): Future<Either<string, PlayCommand>> {
    return pipe(
      subscription.getAudioState,
      Future.fromIO,
      Future.chain(state =>
        pipe(
          validateAudioAndStateChannel(interaction, state),
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
    f: (suscription: AudioSubscription) => IO<NotUsed>,
  ): Future<NotUsed> {
    const guild = interaction.guild
    if (guild === null) return Future.notUsed
    return pipe(
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(guild)),
      Future.bind('subscriptionState', ({ subscription }) =>
        Future.fromIO(subscription.getAudioState),
      ),
      Future.chain(({ subscription, subscriptionState }) =>
        pipe(
          validateAudioChannel(interaction, subscriptionState),
          Either.fold<string, GuildAudioChannel, IO<Either<string, NotUsed>>>(
            flow(Either.left, IO.right),
            () => pipe(f(subscription), IO.map(Either.right)),
          ),
          Future.fromIOEither,
          Future.chain(
            Either.fold(
              content =>
                DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
              () =>
                pipe(
                  DiscordConnector.interactionUpdate(interaction),
                  Future.matchE(
                    e =>
                      isUnknownMessageError(e)
                        ? Future.notUsed // maybe it was deleted before we can update the interaction)
                        : Future.left(e),
                    Future.right,
                  ),
                ),
            ),
          ),
        ),
      ),
    )
  }
}

const validateAudioAndStateChannel = (
  interaction: Interaction,
  state: AudioState,
): Either<string, Pick<PlayCommand, 'musicChannel' | 'stateChannel'>> =>
  pipe(
    validateAudioChannel(interaction, state),
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

const validateAudioChannel = (
  interaction: Interaction,
  state: AudioState,
): Either<string, GuildAudioChannel> =>
  pipe(
    interaction.member instanceof GuildMember
      ? Maybe.fromNullable(interaction.member.voice.channel)
      : Maybe.none,
    Either.fromOption(() => 'Haha ! Il faut être dans un salon vocal pour faire ça !'),
    Either.filterOrElse(
      audioChannel =>
        AudioState.isDisconnected(state) ||
        !AudioStateValue.is('Music')(state.value) ||
        state.channel.id === audioChannel.id,
      () => 'Haha ! Il faut être dans mon salon pour faire ça !',
    ),
  )

const tracksAddedInteractionReply = (tracks: NonEmptyArray<Track>): string =>
  pipe(
    tracks,
    NonEmptyArray.map(t => `"${t.title}"`),
    List.mkString('', ', ', ` ajouté${tracks.length === 1 ? '' : 's'} à la file d'attente.`),
  )
