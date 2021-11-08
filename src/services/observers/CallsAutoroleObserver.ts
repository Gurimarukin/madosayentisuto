import { APIInteractionGuildMember } from 'discord-api-types/payloads/v9'
import { ButtonInteraction, Guild, GuildMember } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Calls } from '../../models/guildState/Calls'
import { InteractionCreate } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { TSnowflake } from '../../models/TSnowflake'
import { Future, Maybe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { DiscordConnector } from '../DiscordConnector'
import { GuildStateService } from '../GuildStateService'
import { PartialLogger } from '../Logger'
import { getInitCallsMessage } from './commands/AdminCommandsObserver'

type CallsAndMember = {
  readonly calls: Calls
  readonly member: GuildMember
}

export const callsButton = {
  subscribeId: 'callsSubscribe',
  unsubscribeId: 'callsUnsubscribe',
}

export const CallsAutoroleObserver = (
  Logger: PartialLogger,
  guildStateService: GuildStateService,
): TObserver<InteractionCreate> => {
  const logger = Logger('CallsAutoroleObserver')

  return {
    next: event => {
      const interaction = event.interaction

      if (!interaction.isButton()) return Future.unit

      if (interaction.customId === callsButton.subscribeId) return onSubscribe(interaction)
      if (interaction.customId === callsButton.unsubscribeId) return onUnsubscribe(interaction)
      return Future.unit
    },
  }

  function onSubscribe(interaction: ButtonInteraction): Future<void> {
    return withCallsAndMember(interaction, (guild, { calls, member }) =>
      DiscordConnector.hasRole(member, calls.role)
        ? Future.right(true)
        : pipe(
            DiscordConnector.addRole(member, calls.role),
            Future.map(success => {
              const log = LogUtils.pretty(logger, guild)
              return success
                ? log('debug', `Added ${member.user.tag} to role @${calls.role.name}`)
                : log('warn', `Couldn't add ${member.user.tag} to role @${calls.role.name}`)
            }),
            Future.chain(Future.fromIOEither),
            Future.map(() => true),
          ),
    )
  }

  function onUnsubscribe(interaction: ButtonInteraction): Future<void> {
    return withCallsAndMember(interaction, (guild, { calls, member }) =>
      !DiscordConnector.hasRole(member, calls.role)
        ? Future.right(true)
        : pipe(
            DiscordConnector.removeRole(member, calls.role),
            Future.map(success => {
              const log = LogUtils.pretty(logger, guild)
              return success
                ? log('debug', `Removed ${member.user.tag} from role @${calls.role.name}`)
                : log('warn', `Couldn't remove ${member.user.tag} to role @${calls.role.name}`)
            }),
            Future.chain(Future.fromIOEither),
            Future.map(() => true),
          ),
    )
  }

  function withCallsAndMember(
    interaction: ButtonInteraction,
    f: (guild: Guild, callsAndMember: CallsAndMember) => Future<boolean>,
  ): Future<void> {
    const guild = interaction.guild
    return pipe(
      guild === null
        ? Future.right(Maybe.none)
        : pipe(
            fetchCallsAndMember(guild, interaction.member),
            Future.chain(
              Maybe.fold(
                () => Future.right(Maybe.none),
                callsAndMember =>
                  pipe(
                    f(guild, callsAndMember),
                    Future.map(success => (success ? Maybe.some(callsAndMember) : Maybe.none)),
                  ),
              ),
            ),
          ),
      Future.chain(
        Maybe.fold(
          () => Future.unit,
          ({ calls }) => refreshCallsInitMessage(calls),
        ),
      ),
      Future.chain(() => DiscordConnector.interactionUpdate(interaction, {})),
    )
  }

  function refreshCallsInitMessage(calls: Calls): Future<void> {
    return pipe(
      DiscordConnector.messageEdit(calls.message, getInitCallsMessage(calls.channel, calls.role)),
      Future.map(() => {}),
    )
  }

  function fetchCallsAndMember(
    guild: Guild,
    member: GuildMember | APIInteractionGuildMember,
  ): Future<Maybe<CallsAndMember>> {
    return pipe(
      apply.sequenceS(Future.ApplyPar)({
        calls: guildStateService.getCalls(guild),
        member:
          member instanceof GuildMember
            ? Future.right(Maybe.some(member))
            : DiscordConnector.fetchMember(guild, TSnowflake.wrap(member.user.id)),
      }),
      Future.map(apply.sequenceS(Maybe.Apply)),
    )
  }
}
