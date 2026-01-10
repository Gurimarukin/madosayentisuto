import type {
  ApplicationEmoji,
  AuditLogEvent,
  Collection,
  Guild,
  GuildAuditLogsEntry,
  GuildAuditLogsFetchOptions,
  GuildEmoji,
} from 'discord.js'
import { string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { StringUtils } from '../../shared/utils/StringUtils'
import type { Future } from '../../shared/utils/fp'
import { List, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from './DiscordConnector'

const fetchLastAuditLog = <A extends AuditLogEvent = AuditLogEvent>(
  guild: Guild,
  options?: Omit<GuildAuditLogsFetchOptions<A>, 'limit'>,
): Future<Maybe<GuildAuditLogsEntry<A>>> =>
  pipe(
    DiscordConnector.fetchAuditLogs(guild, { ...options, limit: 1 }),
    futureMaybe.map(logs => logs.toJSON()),
    futureMaybe.chainOptionK(List.head),
  )

const getEmoji =
  (guild: Guild) =>
  (emojiRaw: string): Maybe<GuildEmoji | ApplicationEmoji> =>
    pipe(
      getEmojiBis(guild.emojis.valueOf(), emojiRaw),
      Maybe.alt(() => getEmojiBis(guild.client.application.emojis.valueOf(), emojiRaw)),
    )

function getEmojiBis(
  emojis_: Collection<string, GuildEmoji | ApplicationEmoji>,
  emojiRaw: string,
): Maybe<GuildEmoji | ApplicationEmoji> {
  const emojis = emojis_.toJSON()

  const findById = (id: string): Maybe<GuildEmoji | ApplicationEmoji> =>
    pipe(
      emojis,
      List.findFirst(e => string.Eq.equals(e.id, id)),
    )

  const findByName = (name: string): Maybe<GuildEmoji | ApplicationEmoji> =>
    pipe(
      emojis,
      List.findFirst(e => string.Eq.equals(e.name.toLowerCase(), name)),
    )

  const alts: List<(raw: string) => Maybe<Maybe<GuildEmoji | ApplicationEmoji>>> = [
    flow(parseEmojiTagNameId, Maybe.map(findById)),
    flow(parseEmojiTagId, Maybe.map(findById)),
    flow(parseEmojiMarkup, Maybe.map(findByName)),
    // 986925500595327036
    flow(findById, Maybe.map(Maybe.some)),
    // billy
    flow(findByName, Maybe.map(Maybe.some)),
  ]

  // toLowerCase because we do toLowerCase in findByName
  const emoji = emojiRaw.trim().toLowerCase()

  return pipe(
    alts,
    List.reduce(Maybe.none as Maybe<Maybe<GuildEmoji | ApplicationEmoji>>, (acc, f) =>
      pipe(
        acc,
        Maybe.alt(() => f(emoji)),
      ),
    ),
    Maybe.flatten,
  )
}

type EmojiId = string
type EmojiName = string

// <:billy:986925500595327036>
// <a:billy:986925500595327036>
const parseEmojiTagNameId: (raw: string) => Maybe<EmojiId> =
  StringUtils.matcher1(/^<a?:\S+:(\S+)>$/)

// <emoji:986925500595327036>
const parseEmojiTagId: (raw: string) => Maybe<EmojiId> = StringUtils.matcher1(/^<emoji:(\S+)>$/)

// :billy:
const parseEmojiMarkup: (raw: string) => Maybe<EmojiName> = StringUtils.matcher1(/^:(\S+):$/)

export const GuildHelper = {
  fetchLastAuditLog,
  getEmoji,
}
