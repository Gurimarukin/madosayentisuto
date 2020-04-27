import * as Ord from 'fp-ts/lib/Ord'
import { GuildMember, TextChannel, MessageAttachment } from 'discord.js'
import { randomInt } from 'fp-ts/lib/Random'

import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'
import { GuildMemberEvent } from '../../models/GuildMemberEvent'
import { Future, pipe, IO, Maybe, List } from '../../utils/fp'
import { ChannelUtils } from '../../utils/ChannelUtils'

export const GuildMemberEventsHandler = (
  Logger: PartialLogger,
  discord: DiscordConnector
): ((event: GuildMemberEvent) => Future<unknown>) => {
  const logger = Logger('GuildMemberEventsHandler')

  return GuildMemberEvent.fold({ onAdd, onRemove })

  function onAdd(member: GuildMember): Future<unknown> {
    return Future.fromIOEither(
      logger.info(`[${member.guild.name}]`, `${member.user.tag} joined the server`)
    )
  }

  function onRemove(member: GuildMember): Future<unknown> {
    return pipe(
      logger.info(`[${member.guild.name}]`, `${member.user.tag} left the server`),
      IO.chain(_ => randomLeaveMessage(member)),
      Future.fromIOEither,
      Future.chain(msg =>
        pipe(
          Maybe.fromNullable(member.guild.systemChannel),
          Maybe.alt(() =>
            pipe(
              member.guild.channels.cache.array(),
              List.filter(ChannelUtils.isText),
              List.sort(ordChannel),
              List.head
            )
          ),
          Maybe.fold<TextChannel, Future<unknown>>(
            () => Future.unit,
            chan =>
              discord.sendMessage(
                chan,
                msg,
                new MessageAttachment(
                  'https://cdn.discordapp.com/attachments/636626556734930948/703943786253910096/b8029fe196b8f1382e90bbe81dab50dc.png'
                )
              )
          )
        )
      )
    )
  }
}

const ordChannel = Ord.contramap((_: TextChannel) => _.position)(Ord.ordNumber)

const randomLeaveMessage = (member: GuildMember): IO<string> =>
  pipe(
    randomInt(0, leaveMessages.length - 1),
    IO.rightIO,
    IO.map(_ => leaveMessages[_](`**${member.user.tag}**`))
  )

const leaveMessages: ((member: string) => string)[] = [
  _ => `${_} est parti parce qu'il en avait marre de vous.`,
  _ => `Gibier de potence, ${_} quitte le navire...`,
  _ => `La trahison de ${_} est comme le sel sur une plaie.`,
  _ => `${_} me tourne le dos et invite mon poignard.`,
  _ => `J'ai perdu ${_}, mais pas mon âme.`,
  _ => `Ne jamais faire confiance à ${_}.`,
  _ => `Je vais emmener ${_} aux quais-abattoirs...`
]
