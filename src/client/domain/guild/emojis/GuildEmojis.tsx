/* eslint-disable functional/no-expression-statement,
                  functional/no-return-void */
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'
import React, { useCallback, useRef, useState } from 'react'

import { GuildEmojiId } from '../../../../shared/models/guild/GuildEmojiId'
import type { GuildEmojiView } from '../../../../shared/models/guild/GuildEmojiView'
import type { GuildId } from '../../../../shared/models/guild/GuildId'
import { NonEmptyArray } from '../../../../shared/utils/fp'
import { List, Maybe } from '../../../../shared/utils/fp'

import { Tooltip } from '../../../components/Tooltip'
import { useDrag, useDrop } from '../../../libs/react-dnd'
import { GuildLayout } from '../GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildEmojis = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="emojis">
    {guild => <Tiers emojis={guild.emojis} />}
  </GuildLayout>
)

type TiersProps = {
  readonly emojis: List<GuildEmojiView>
}

type Tier = {
  readonly name: string // TODO: ensure unicity
  readonly emojis: List<GuildEmojiView>
}

const tierLensEmojis = pipe(lens.id<Tier>(), lens.prop('emojis'))
const Tier = {
  modifyEmojis: (f: (a: List<GuildEmojiView>) => List<GuildEmojiView>): ((tier: Tier) => Tier) =>
    pipe(tierLensEmojis, lens.modify(f)),
}

const Tiers = ({ emojis }: TiersProps): JSX.Element => {
  const [tiers, setTiers] = useState<NonEmptyArray<Tier>>([
    { name: 'S', emojis },
    { name: 'A', emojis: [] },
    { name: 'B', emojis: [] },
    { name: 'C', emojis: [] },
  ])

  const moveEmojiTier = useCallback(
    (item: DragItem, newTierIndex: number) => {
      pipe(
        emojis,
        List.findFirst(e => e.id === item.emojiId),
        Maybe.map(emoji =>
          setTiers(
            NonEmptyArray.mapWithIndex((i, tier) =>
              i === item.tierIndex
                ? pipe(tier, Tier.modifyEmojis(List.filter(e => e.id !== emoji.id)))
                : i === newTierIndex
                ? pipe(tier, Tier.modifyEmojis(List.append(emoji)))
                : tier,
            ),
          ),
        ),
      )
    },
    [emojis],
  )

  return (
    <div className="p-6">
      <ul className="grid w-full grid-cols-[auto_auto] border-t border-gray1">
        {tiers.map((tier, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <TierComponent key={i} tier={tier} tierIndex={i} moveEmojiTier={moveEmojiTier} />
        ))}
      </ul>
    </div>
  )
}

type TierProps = {
  readonly tier: Tier
  readonly tierIndex: number
  readonly moveEmojiTier: (item: DragItem, newTierIndex: number) => void
}

const TierComponent = ({ tier, tierIndex, moveEmojiTier }: TierProps): JSX.Element => {
  const [, drop] = useDrop<DragItem>(() => ({
    accept: emojiType,
    hover: (item: DragItem) => {
      if (item.tierIndex === tierIndex) return

      moveEmojiTier(item, tierIndex)

      // eslint-disable-next-line functional/immutable-data
      item.tierIndex = tierIndex
    },
  }))

  return (
    <li ref={drop} className="contents">
      <span className="flex min-h-[calc(7rem_+_1px)] items-center border-x border-b border-gray1 bg-gray2 p-6 text-2xl">
        {tier.name}
      </span>
      <ul className="flex flex-wrap border-r border-b border-gray1">
        {tier.emojis.map(emoji => (
          <GuildEmoji key={GuildEmojiId.unwrap(emoji.id)} tierIndex={tierIndex} emoji={emoji} />
        ))}
      </ul>
    </li>
  )
}

type GuildEmojiProps = {
  readonly tierIndex: number
  readonly emoji: GuildEmojiView
}

type DragItem = {
  readonly emojiId: GuildEmojiId
  // eslint-disable-next-line functional/prefer-readonly-type
  tierIndex: number
}

const emojiType = 'emoji' as const

const GuildEmoji = ({ tierIndex, emoji }: GuildEmojiProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null)
  const [, drop] = useDrop<DragItem>(() => ({
    accept: emojiType,
    hover: (item: DragItem) => {
      if (item.emojiId === emoji.id) return
      if (item.tierIndex !== tierIndex) return

      console.log('Emoji hover', item)

      // moveEmojiTier(item, tierIndex)

      // // eslint-disable-next-line functional/immutable-data
      // item.tierIndex = tierIndex
    },
  }))

  const [{ isDragging }, drag] = useDrag(() => ({
    type: emojiType,
    item: (): DragItem => ({ emojiId: emoji.id, tierIndex }),
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  }))

  drag(drop(ref))

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0 : 1 }}>
      <Tooltip
        title={pipe(
          emoji.name,
          Maybe.getOrElse(() => emoji.url),
        )}
      >
        <img
          src={emoji.url}
          alt={pipe(
            emoji.name,
            Maybe.fold(
              () => 'Emoji inconnu',
              n => `Emoji ${n}`,
            ),
          )}
          className="h-28 w-28 object-contain"
        />
      </Tooltip>
    </div>
  )
}
