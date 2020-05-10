import { MessageReaction, User, PartialUser, Message, GuildMember } from 'discord.js'

import { PartialLogger } from '../Logger'
import { DiscordConnector } from '../DiscordConnector'
import { GuildStateService } from '../GuildStateService'
import { callsEmoji } from '../../Application'
import { AddRemove } from '../../models/AddRemove'
import { Calls } from '../../models/guildState/Calls'
import { Future, pipe, Maybe } from '../../utils/fp'

export const MessageReactionsHandler = (
  Logger: PartialLogger,
  discord: DiscordConnector,
  guildStateService: GuildStateService
): ((event: AddRemove<[MessageReaction, User | PartialUser]>) => Future<unknown>) => {
  const _logger = Logger('MessagesHandler')

  return event => {
    const [reaction, user] = event.value
    return isCallsEmoji(reaction.emoji.identifier)
      ? pipe(
          Maybe.fromNullable(reaction.message.guild),
          Maybe.fold(
            () => Future.unit, // not a Guild message
            guild =>
              pipe(
                guildStateService.getCalls(guild),
                Future.chain(
                  Maybe.fold(
                    () => Future.unit, // no Calls associated to this Guild
                    calls =>
                      pipe(
                        discord.fetchPartial(user),
                        Future.chain(_ => discord.fetchMemberForUser(guild, _)),
                        Future.chain(
                          Maybe.fold(
                            () => Future.unit, // couldn't retrieve GuildMember
                            member =>
                              isCallsMessage(calls, reaction.message)
                                ? pipe(
                                    event,
                                    AddRemove.fold({
                                      onAdd: onAdd(member, calls),
                                      onRemove: onRemove(member, calls)
                                    })
                                  )
                                : Future.unit // a reaction, but not to Calls' message
                          )
                        )
                      )
                  )
                )
              )
          )
        )
      : Future.unit
  }

  function isCallsEmoji(identifier: string): boolean {
    return identifier === callsEmoji
  }

  function isCallsMessage(calls: Calls, message: Message): boolean {
    return calls.message.id === message.id
  }

  function onAdd(member: GuildMember, calls: Calls): (_: unknown) => Future<unknown> {
    return _ => discord.addRole(member, calls.role)
  }

  function onRemove(member: GuildMember, calls: Calls): (_: unknown) => Future<unknown> {
    return _ => discord.removeRole(member, calls.role)
  }
}
