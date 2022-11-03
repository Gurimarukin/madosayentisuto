import type { ButtonInteraction, Role } from 'discord.js'
import { GuildMember } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../shared/utils/fp'
import { Either, Future, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { AutoroleMessage } from '../helpers/messages/AutoroleMessage'
import type { RoleId } from '../models/RoleId'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { LogUtils } from '../utils/LogUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const AutoroleObserver = (Logger: LoggerGetter) => {
  const logger = Logger('CallsAutoroleObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(event => {
    const interaction = event.interaction

    if (!interaction.isButton()) return Future.notUsed

    return pipe(
      AutoroleMessage.Ids.Buttons.add.decode(interaction.customId),
      Either.map(onAutoroleAdd(interaction)),
      Either.orElse(() =>
        pipe(
          AutoroleMessage.Ids.Buttons.remove.decode(interaction.customId),
          Either.map(onAutoroleRemove(interaction)),
        ),
      ),
      Either.getOrElse(() => Future.notUsed),
    )
  })

  function onAutoroleAdd(interaction: ButtonInteraction): (roleId: RoleId) => Future<NotUsed> {
    return withRoleAndMember(interaction, (role, member) =>
      DiscordConnector.hasRole(member, role)
        ? Future.right(false)
        : pipe(
            DiscordConnector.roleAdd(member, role),
            Future.chainFirstIOEitherK(success => {
              const log = LogUtils.pretty(logger, role.guild)
              return success
                ? log.info(`Added ${member.user.tag} to role @${role.name}`)
                : log.info(`Couldn't add ${member.user.tag} to role @${role.name}`)
            }),
          ),
    )
  }

  function onAutoroleRemove(interaction: ButtonInteraction): (roleId: RoleId) => Future<NotUsed> {
    return withRoleAndMember(interaction, (role, member) =>
      DiscordConnector.hasRole(member, role)
        ? pipe(
            DiscordConnector.roleRemove(member, role),
            Future.chainFirstIOEitherK(success => {
              const log = LogUtils.pretty(logger, role.guild)
              return success
                ? log.info(`Removed ${member.user.tag} from role @${role.name}`)
                : log.info(`Couldn't remove ${member.user.tag} from role @${role.name}`)
            }),
          )
        : Future.right(false),
    )
  }
}

const withRoleAndMember =
  (interaction: ButtonInteraction, f: (role: Role, member: GuildMember) => Future<boolean>) =>
  (roleId: RoleId): Future<NotUsed> => {
    const guild = interaction.guild
    if (guild === null) return Future.notUsed

    return pipe(
      DiscordConnector.interactionUpdate(interaction),
      Future.chain(() =>
        apply.sequenceS(futureMaybe.ApplyPar)({
          role: DiscordConnector.fetchRole(guild, roleId),
          member:
            interaction.member instanceof GuildMember
              ? futureMaybe.some(interaction.member)
              : DiscordConnector.fetchMember(guild, DiscordUserId.fromUser(interaction.user)),
        }),
      ),
      futureMaybe.chainTaskEitherK(({ role, member }) => f(role, member)),
      futureMaybe.filter(success => success),
      futureMaybe.chainTaskEitherK(() =>
        DiscordConnector.messageEdit(
          interaction.message,
          AutoroleMessage.optionsFromMessage(interaction.message),
        ),
      ),
      Future.map(toNotUsed),
    )
  }
