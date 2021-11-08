import { APIInteractionGuildMember } from 'discord-api-types/payloads/v9'
import { ButtonInteraction, Guild, GuildMember, Role } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { InteractionCreate } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { TSnowflake } from '../../models/TSnowflake'
import { Future, Maybe, todo } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { DiscordConnector } from '../DiscordConnector'
import { GuildStateService } from '../GuildStateService'
import { PartialLogger } from '../Logger'

type RoleAndMember = {
  readonly role: Role
  readonly member: GuildMember
}

export const callsButton = {
  subscribeId: 'callsSubscribe',
  unsubscribeId: 'callsUnsubscribe',
}

export const CallsAutoroleObserver = (
  Logger: PartialLogger,
  discord: DiscordConnector,
  guildStateService: GuildStateService,
): TObserver<InteractionCreate> => {
  const logger = Logger('CallsAutoroleObserver')

  return {
    next: event => {
      const interaction = event.interaction
      const guild = interaction.guild

      if (!interaction.isButton() || guild === null) return Future.unit

      if (interaction.customId === callsButton.subscribeId) {
        return onSubscribe(interaction, guild)
      }

      if (interaction.customId === callsButton.unsubscribeId) {
        return onUnsubscribe(interaction, guild)
      }

      return Future.unit
    },
  }

  function onSubscribe(interaction: ButtonInteraction, guild: Guild): Future<void> {
    return pipe(
      fetchCallsAndMember(guild, interaction.member),
      Future.map(Maybe.filter(({ role, member }) => DiscordConnector.hasRole(member, role))),
      Future.chain(
        Maybe.fold(
          () => Future.unit,
          ({ role, member }) =>
            pipe(
              DiscordConnector.addRole(member, role),
              Future.map(success => {
                const log = LogUtils.pretty(logger, guild)
                return success
                  ? log('debug', `Added user ${member.user.tag} to role @${role.name}`)
                  : log('warn', `Couldn't add ${member.user.tag} to role @${role.name}`)
              }),
              Future.chain(Future.fromIOEither),
            ),
        ),
      ),
    )
  }

  function onUnsubscribe(interaction: ButtonInteraction, guild: Guild): Future<void> {
    return todo(interaction, guild)
  }

  function fetchCallsAndMember(
    guild: Guild,
    member: GuildMember | APIInteractionGuildMember,
  ): Future<Maybe<RoleAndMember>> {
    return pipe(
      apply.sequenceS(Future.ApplyPar)({
        role: pipe(guildStateService.getCalls(guild), Future.map(Maybe.map(({ role }) => role))),
        member:
          member instanceof GuildMember
            ? Future.right(Maybe.some(member))
            : DiscordConnector.fetchMember(guild, TSnowflake.wrap(member.user.id)),
      }),
      Future.map(apply.sequenceS(Maybe.Apply)),
    )
  }
}
