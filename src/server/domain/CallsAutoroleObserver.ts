import type { APIInteractionGuildMember, ButtonInteraction, Guild, Role } from 'discord.js'
import { GuildMember } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../shared/utils/fp'
import { Either, Future, IO, Maybe, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { AutoroleMessage } from '../helpers/messages/AutoroleMessage'
import { initCallsButton, initCallsMessage } from '../helpers/messages/initCallsMessage'
import { RoleId } from '../models/RoleId'
import { MadEvent } from '../models/event/MadEvent'
import type { Calls } from '../models/guildState/Calls'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

type CallsAndMember = {
  readonly calls: Calls
  readonly member: GuildMember
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const CallsAutoroleObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('CallsAutoroleObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(event => {
    const interaction = event.interaction

    if (!interaction.isButton()) return Future.notUsed

    switch (interaction.customId) {
      case initCallsButton.subscribeId:
        return onSubscribe(interaction)
      case initCallsButton.unsubscribeId:
        return onUnsubscribe(interaction)
    }

    return pipe(
      AutoroleMessage.ButtonIds.add.decode(interaction.customId),
      Either.map(onAutoroleAdd(interaction)),
      Either.orElse(() =>
        pipe(
          AutoroleMessage.ButtonIds.remove.decode(interaction.customId),
          Either.map(onAutoroleRemove(interaction)),
        ),
      ),
      Either.getOrElse(() => Future.notUsed),
    )
  })

  function onSubscribe(interaction: ButtonInteraction): Future<NotUsed> {
    return withCallsAndMember(interaction, (guild, { calls, member }) =>
      DiscordConnector.hasRole(member, calls.role)
        ? Future.right(true)
        : pipe(
            DiscordConnector.roleAdd(member, calls.role),
            Future.chainIOEitherK(success => {
              const log = LogUtils.pretty(logger, guild)
              return success
                ? log.info(`Added ${member.user.tag} to role @${calls.role.name}`)
                : log.info(`Couldn't add ${member.user.tag} to role @${calls.role.name}`)
            }),
            Future.map(() => true),
          ),
    )
  }

  function onUnsubscribe(interaction: ButtonInteraction): Future<NotUsed> {
    return withCallsAndMember(interaction, (guild, { calls, member }) =>
      !DiscordConnector.hasRole(member, calls.role)
        ? Future.right(true)
        : pipe(
            DiscordConnector.roleRemove(member, calls.role),
            Future.chainIOEitherK(success => {
              const log = LogUtils.pretty(logger, guild)
              return success
                ? log.info(`Removed ${member.user.tag} from role @${calls.role.name}`)
                : log.info(`Couldn't remove ${member.user.tag} from role @${calls.role.name}`)
            }),
            Future.map(() => true),
          ),
    )
  }

  function withCallsAndMember(
    interaction: ButtonInteraction,
    f: (guild: Guild, callsAndMember: CallsAndMember) => Future<boolean>,
  ): Future<NotUsed> {
    return pipe(
      futureMaybe.Do,
      Future.chainFirst(() => DiscordConnector.interactionUpdate(interaction)),
      futureMaybe.apS('guild', futureMaybe.fromNullable(interaction.guild)),
      futureMaybe.bind('member', ({ guild }) => interactionMember(guild, interaction)),
      futureMaybe.bind('callsAndMember', ({ guild, member }) => fetchCallsAndMember(guild, member)),
      futureMaybe.bind('success', ({ guild, callsAndMember }) =>
        pipe(f(guild, callsAndMember), Future.map(Maybe.some)),
      ),
      futureMaybe.filter(({ success }) => success),
      futureMaybe.chainTaskEitherK(({ callsAndMember: { calls } }) =>
        refreshCallsInitMessage(calls),
      ),
      Future.map(toNotUsed),
    )
  }

  function interactionMember(
    guild: Guild,
    interaction: ButtonInteraction,
  ): Future<Maybe<GuildMember | APIInteractionGuildMember>> {
    return pipe(
      futureMaybe.fromNullable(interaction.member),
      Future.chainFirstIOEitherK(
        Maybe.fold(
          () => LogUtils.pretty(logger, guild).warn('interaction.member was null'),
          () => IO.notUsed,
        ),
      ),
    )
  }

  function refreshCallsInitMessage(calls: Calls): Future<NotUsed> {
    return pipe(
      DiscordConnector.messageEdit(calls.message, initCallsMessage(calls.channel, calls.role)),
      Future.map(toNotUsed),
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
          ? futureMaybe.some(member)
          : DiscordConnector.fetchMember(guild, DiscordUserId.fromUser(member.user)),
    })
  }

  function onAutoroleAdd(interaction: ButtonInteraction): (roleId: string) => Future<NotUsed> {
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

  function onAutoroleRemove(interaction: ButtonInteraction): (roleId: string) => Future<NotUsed> {
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
  (roleId: string): Future<NotUsed> => {
    const guild = interaction.guild
    if (guild === null) return Future.notUsed

    return pipe(
      DiscordConnector.interactionUpdate(interaction),
      Future.chain(() =>
        apply.sequenceS(futureMaybe.ApplyPar)({
          role: DiscordConnector.fetchRole(guild, RoleId.wrap(roleId)),
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
          AutoroleMessage.fromMessage(interaction.message),
        ),
      ),
      Future.map(toNotUsed),
    )
  }
