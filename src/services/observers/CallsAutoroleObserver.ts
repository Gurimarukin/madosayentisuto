import { APIInteractionGuildMember } from 'discord-api-types/payloads/v9'
import { ButtonInteraction, Guild, GuildMember, Role } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { InteractionCreate } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { TSnowflake } from '../../models/TSnowflake'
import { Future, Maybe } from '../../utils/fp'
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

      if (!interaction.isButton()) return Future.unit

      if (interaction.customId === callsButton.subscribeId) return onSubscribe(interaction)
      if (interaction.customId === callsButton.unsubscribeId) return onUnsubscribe(interaction)
      return Future.unit
    },
  }

  function onSubscribe(interaction: ButtonInteraction): Future<void> {
    return withCallsAndMember(
      interaction,
      'Bienvenue à bord, moussaillon !',
      guild =>
        ({ role, member }) =>
          DiscordConnector.hasRole(member, role)
            ? Future.right(true)
            : pipe(
                DiscordConnector.addRole(member, role),
                Future.map(success => {
                  const log = LogUtils.pretty(logger, guild)
                  return success
                    ? log('debug', `Added ${member.user.tag} to role @${role.name}`)
                    : log('warn', `Couldn't add ${member.user.tag} to role @${role.name}`)
                }),
                Future.chain(Future.fromIOEither),
                Future.map(() => true),
              ),
    )
  }

  function onUnsubscribe(interaction: ButtonInteraction): Future<void> {
    return withCallsAndMember(
      interaction,
      'Haha ! À la prochaine...\n(Victime.)',
      guild =>
        ({ role, member }) =>
          !DiscordConnector.hasRole(member, role)
            ? Future.right(true)
            : pipe(
                DiscordConnector.removeRole(member, role),
                Future.map(success => {
                  const log = LogUtils.pretty(logger, guild)
                  return success
                    ? log('debug', `Removed ${member.user.tag} from role @${role.name}`)
                    : log('warn', `Couldn't remove ${member.user.tag} to role @${role.name}`)
                }),
                Future.chain(Future.fromIOEither),
                Future.map(() => true),
              ),
    )
  }

  function withCallsAndMember(
    interaction: ButtonInteraction,
    successMessage: string,
    f: (guild: Guild) => (roleAndMember: RoleAndMember) => Future<boolean>,
  ): Future<void> {
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.chain(() =>
        interaction.guild === null
          ? Future.right(false)
          : pipe(
              fetchCallsAndMember(interaction.guild, interaction.member),
              Future.chain(Maybe.fold(() => Future.right(false), f(interaction.guild))),
            ),
      ),
      Future.chain(success =>
        DiscordConnector.interactionEditReply(interaction, {
          content: success ? successMessage : "Ça n'a pas fonctionné...",
          ephemeral: true,
        }),
      ),
      Future.map(() => {}),
    )
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
