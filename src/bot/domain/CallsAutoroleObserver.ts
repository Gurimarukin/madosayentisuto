import type { APIInteractionGuildMember } from 'discord-api-types/payloads/v9'
import type { ButtonInteraction, Guild } from 'discord.js'
import { GuildMember } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { futureMaybe } from '../../shared/utils/FutureMaybe'
import { Future, Maybe } from '../../shared/utils/fp'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { callsButton, getInitCallsMessage } from '../helpers/getInitCallsMessage'
import { TSnowflake } from '../models/TSnowflake'
import type { MadEventInteractionCreate } from '../models/events/MadEvent'
import type { Calls } from '../models/guildState/Calls'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

type CallsAndMember = {
  readonly calls: Calls
  readonly member: GuildMember
}

export const CallsAutoroleObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventInteractionCreate> => {
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
    return pipe(
      futureMaybe.Do,
      futureMaybe.bind('guild', () => futureMaybe.fromNullable(interaction.guild)),
      futureMaybe.bind('callsAndMember', ({ guild }) =>
        fetchCallsAndMember(guild, interaction.member),
      ),
      futureMaybe.bind('success', ({ guild, callsAndMember }) =>
        pipe(f(guild, callsAndMember), Future.map(Maybe.some)),
      ),
      Future.map(Maybe.filter(({ success }) => success)),
      futureMaybe.chainFuture(({ callsAndMember: { calls } }) => refreshCallsInitMessage(calls)),
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
    return apply.sequenceS(futureMaybe.ApplyPar)({
      calls: guildStateService.getCalls(guild),
      member:
        member instanceof GuildMember
          ? Future.right(Maybe.some(member))
          : DiscordConnector.fetchMember(guild, TSnowflake.wrap(member.user.id)),
    })
  }
}
