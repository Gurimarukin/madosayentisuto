import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  TextChannel,
} from 'discord.js'
import { GuildMember } from 'discord.js'
import { string } from 'fp-ts'
import { flow, identity, pipe } from 'fp-ts/function'

import type { Track } from '../../../shared/models/audio/music/Track'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Either, Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../../shared/utils/fp'

import type { AudioSubscription } from '../../helpers/AudioSubscription'
import { DiscordConnector, isUnknownMessageError } from '../../helpers/DiscordConnector'
import type { YtDlp } from '../../helpers/YtDlp'
import { YtDlpResult } from '../../helpers/YtDlp'
import { PlayerStateMessage } from '../../helpers/messages/PlayerStateMessage'
import { AudioState } from '../../models/audio/AudioState'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import type { GuildStateService } from '../../services/GuildStateService'
import type { GuildAudioChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { utilInspect } from '../../utils/utilInspect'

type PlayCommand = ElevatorCommand & {
  tracks: NonEmptyArray<Track>
}

type ElevatorCommand = {
  musicChannel: GuildAudioChannel
  stateChannel: TextChannel
}

const Keys = {
  elevator: 'ascenseur',
}

const playCommands = pipe(
  PlayerStateMessage.Keys.play,
  List.map(name =>
    Command.chatInput({
      name,
      description: 'Jean Plank joue un petit air',
    })(
      Command.option.string({
        name: PlayerStateMessage.Keys.track,
        description: 'Lien ou recherche YouTube, lien Bandcamp, fichier, etc.',
        required: true,
      }),
    ),
  ),
)

const elevatorCommand = Command.chatInput({
  name: Keys.elevator,
  description: 'Jean Plank vient vous tenir companie avec sa liste de lecture spécial ascenseur',
})()

export const playerCommands = [...playCommands, elevatorCommand]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PlayerCommandsObserver = (
  Logger: LoggerGetter,
  ytDlp: YtDlp,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('PlayerCommandsObserver')

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
    if (List.elem(string.Eq)(interaction.commandName, PlayerStateMessage.Keys.play)) {
      return onPlayCommand(interaction)
    }
    switch (interaction.commandName) {
      case Keys.elevator:
        return onElevatorCommand(interaction)
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
          Either.fold(flow(Either.left, IO.right), ({ musicChannel, stateChannel, tracks }) =>
            pipe(
              subscription.queueTracks(interaction.user, musicChannel, stateChannel, tracks),
              IO.map(() => Either.right(tracksAddedInteractionReply(tracks))),
            ),
          ),
        ),
      ),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, {
          content: pipe(content, Either.getOrElse(identity)),
          ephemeral: Either.isLeft(content),
        }),
      ),
      Future.map(toNotUsed),
    )
  }

  function onElevatorCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    const guild = interaction.guild
    if (guild === null) return Future.notUsed
    return pipe(
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(guild)),
      Future.bind('command', ({ subscription }) =>
        validateElevatorCommand(interaction, subscription),
      ),
      Future.chainIOEitherK(({ subscription, command }) =>
        pipe(
          command,
          Either.fold(flow(Either.left, IO.right), ({ musicChannel, stateChannel }) =>
            pipe(
              subscription.startElevator(interaction.user, musicChannel, stateChannel),
              IO.map(() => Either.right(elevatorStartedInteractionReply)),
            ),
          ),
        ),
      ),
      Future.chain(content =>
        DiscordConnector.interactionReply(interaction, {
          content: pipe(content, Either.getOrElse(identity)),
          ephemeral: Either.isLeft(content),
        }),
      ),
    )
  }

  function onButton(interaction: ButtonInteraction): Future<NotUsed> {
    switch (interaction.customId) {
      case PlayerStateMessage.ButtonIds.playPause:
        return onPlayPauseButton(interaction)
      case PlayerStateMessage.ButtonIds.next:
        return onNextButton(interaction)
      case PlayerStateMessage.ButtonIds.stop:
        return onStopButton(interaction)
    }
    return Future.notUsed
  }

  function onPlayPauseButton(interaction: ButtonInteraction): Future<NotUsed> {
    return buttonCommon(interaction, subscription => subscription.playPauseTrack)
  }

  function onNextButton(interaction: ButtonInteraction): Future<NotUsed> {
    return buttonCommon(interaction, subscription => subscription.playNextTrack(interaction.user))
  }

  function onStopButton(interaction: ButtonInteraction): Future<NotUsed> {
    return buttonCommon(interaction, subscription => subscription.stop)
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
          Either.fold(flow(Either.left, Future.successful), ({ musicChannel, stateChannel }) =>
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
      interaction.options.getString(PlayerStateMessage.Keys.track),
      Maybe.fromNullable,
      Maybe.fold(
        () =>
          Future.successful(Either.left(`Argument manquant : ${PlayerStateMessage.Keys.track}`)),
        validateTracks,
      ),
    )
  }

  function validateTracks(url: string): Future<Either<string, NonEmptyArray<Track>>> {
    return pipe(
      ytDlp.metadata(url),
      Future.chainIOEitherK((res): IO<Either<string, NonEmptyArray<Track>>> => {
        switch (res.type) {
          case 'Success':
            return pipe(
              res.value.videos,
              NonEmptyArray.map(
                (v): Track => ({
                  extractor: res.value.extractor,
                  title: v.title,
                  url: v.webpage_url,
                  thumbnail: v.thumbnail,
                }),
              ),
              Either.right,
              IO.right,
            )
          case 'UnsupportedURLError':
            return IO.right(Either.left('URL invalide.'))
          case 'DecodeError':
            return IO.left(YtDlpResult.decodeError(res))
        }
      }),
      Future.orElse(e =>
        pipe(
          logger.error(`validateTrack Error:\n${utilInspect(e)}`),
          IO.map(() => Either.left<string, NonEmptyArray<Track>>('Erreur')),
          Future.fromIOEither,
        ),
      ),
    )
  }

  function validateElevatorCommand(
    interaction: ChatInputCommandInteraction,
    subscription: AudioSubscription,
  ): Future<Either<string, ElevatorCommand>> {
    return pipe(
      subscription.getAudioState,
      Future.fromIO,
      Future.map(state =>
        !AudioState.isDisconnected(state)
          ? Either.left('Haha ! Tu ne peux pas faire ça maintenant !')
          : validateAudioAndStateChannel(interaction, state),
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
                        : Future.failed(e),
                    Future.successful,
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
): Either<string, ElevatorCommand> =>
  pipe(
    validateAudioChannel(interaction, state),
    Either.chain(musicChannel =>
      pipe(
        Maybe.fromNullable(interaction.channel),
        Either.fromOption(
          () => "Alors ça, c'est chelou : comment peut-on faire une interaction sans salon ?",
        ),
        Either.filterOrElse(
          ChannelUtils.isGuildText,
          () => 'Haha ! Tu ne peux pas faire ça dans ce type de salon !',
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
      audioChannel => AudioState.isDisconnected(state) || state.channel.id === audioChannel.id,
      () => 'Haha ! Il faut être dans mon salon pour faire ça !',
    ),
  )

const tracksAddedInteractionReply = (tracks: NonEmptyArray<Track>): string =>
  pipe(
    tracks,
    NonEmptyArray.map(t => `"${t.title}"`),
    List.mkString('', ', ', ` ajouté${tracks.length === 1 ? '' : 's'} à la file d'attente.`),
  )

const elevatorStartedInteractionReply = 'Ascenseur appelé.'
