import type {
  AuditLogEvent,
  Guild,
  GuildAuditLogsEntry,
  GuildAuditLogsFetchOptions,
  GuildEmoji,
  GuildMember,
} from 'discord.js'
import { refinement, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { StringUtils } from '../../shared/utils/StringUtils'
import type { Future } from '../../shared/utils/fp'
import { List, Maybe, NonEmptyArray, Tuple, refinementFromPredicate } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { GuildAudioChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'
import { DiscordConnector } from './DiscordConnector'

const membersInPublicAudioChans = (
  guild: Guild,
): List<Tuple<GuildAudioChannel, NonEmptyArray<GuildMember>>> =>
  pipe(
    guild.channels.cache.toJSON(),
    List.filter(isPublicAudio),
    List.filterMap(channel =>
      pipe(
        channel.members.toJSON(),
        NonEmptyArray.fromReadonlyArray,
        Maybe.map(members => Tuple.of(channel, members)),
      ),
    ),
    // List.filter(member => DiscordUserId.fromUser(member.user) !== clientId), // don't count bot
  )

const isPublicAudio = pipe(
  ChannelUtils.isGuildAudio,
  refinement.compose(refinementFromPredicate<GuildAudioChannel>(ChannelUtils.isPublic)),
)

const fetchLastAuditLog = <A extends AuditLogEvent = AuditLogEvent>(
  guild: Guild,
  options?: Omit<GuildAuditLogsFetchOptions<A>, 'limit'>,
): Future<Maybe<GuildAuditLogsEntry<A>>> =>
  pipe(
    DiscordConnector.fetchAuditLogs(guild, { ...options, limit: 1 }),
    futureMaybe.map(logs => logs.toJSON()),
    futureMaybe.chainOptionK(List.head),
  )

const getEmoji = (guild: Guild): ((emojiRaw: string) => Maybe<GuildEmoji>) => {
  const emojis = guild.emojis.valueOf().toJSON()

  const findById = (id: string): Maybe<GuildEmoji> =>
    pipe(
      emojis,
      List.findFirst(e => string.Eq.equals(e.id, id)),
    )

  const findByName = (name: string): Maybe<GuildEmoji> =>
    pipe(
      emojis,
      List.findFirst(e => string.Eq.equals(e.name.toLowerCase(), name)),
    )

  const alts: List<(raw: string) => Maybe<Maybe<GuildEmoji>>> = [
    flow(parseEmojiTagNameId, Maybe.map(findById)),
    flow(parseEmojiTagId, Maybe.map(findById)),
    flow(parseEmojiMarkup, Maybe.map(findByName)),
    // 986925500595327036
    flow(findById, Maybe.map(Maybe.some)),
    // billy
    flow(findByName, Maybe.map(Maybe.some)),
  ]

  return emojiRaw => {
    // toLowerCase because we do toLowerCase in findByName
    const emoji = emojiRaw.trim().toLowerCase()

    return pipe(
      alts,
      List.reduce(Maybe.none as Maybe<Maybe<GuildEmoji>>, (acc, f) =>
        pipe(
          acc,
          Maybe.alt(() => f(emoji)),
        ),
      ),
      Maybe.flatten,
    )
  }
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
  membersInPublicAudioChans,
  fetchLastAuditLog,
  getEmoji,
}
