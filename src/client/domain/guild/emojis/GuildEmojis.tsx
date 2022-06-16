/* eslint-disable functional/no-expression-statement */
import { pipe } from 'fp-ts/function'
import React, { useCallback, useRef, useState } from 'react'

import type { GuildEmojiView } from '../../../../shared/models/guild/GuildEmojiView'
import type { GuildId } from '../../../../shared/models/guild/GuildId'
import { List, Maybe } from '../../../../shared/utils/fp'

import { Tooltip } from '../../../components/Tooltip'
import type { Identifier } from '../../../libs/dnd-core'
import type { XYCoord } from '../../../libs/react-dnd'
import { useDrag, useDrop } from '../../../libs/react-dnd'
import { GuildLayout } from '../GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildEmojis = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="emojis">
    {guild => <Container emojis={guild.emojis} />}
  </GuildLayout>
)

type ContainerProps = {
  readonly emojis: List<GuildEmojiView>
}

type Item = {
  readonly id: number
  readonly emoji: GuildEmojiView
}

const Container = ({ emojis }: ContainerProps): JSX.Element => {
  const [cards, setCards] = useState<List<Item>>(() =>
    pipe(
      emojis,
      List.mapWithIndex((id, emoji) => ({ id, emoji })),
    ),
  )

  const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
    setCards(prevCards =>
      pipe(
        prevCards,
        List.deleteAt(dragIndex),
        Maybe.getOrElse(() => prevCards),
        deleted =>
          pipe(
            List.lookup(dragIndex, prevCards),
            Maybe.chain(dragged => pipe(deleted, List.insertAt(hoverIndex, dragged))),
          ),
        Maybe.getOrElse(() => prevCards),
      ),
    )
  }, [])

  const renderCard = useCallback(
    (card: Item, index: number) => (
      <GuildEmoji key={card.id} index={index} id={card.id} emoji={card.emoji} moveCard={moveCard} />
    ),
    [moveCard],
  )

  return (
    <div className="flex flex-wrap gap-6 justify-center content-start p-6 w-full">
      {cards.map((card, i) => renderCard(card, i))}
    </div>
  )
}

type CardProps = {
  readonly id: number
  readonly emoji: GuildEmojiView
  readonly index: number
  // eslint-disable-next-line functional/no-return-void
  readonly moveCard: (dragIndex: number, hoverIndex: number) => void
}

type DragItem = {
  // eslint-disable-next-line functional/prefer-readonly-type
  index: number
  readonly id: string
}

const emojiType = 'card' as const

const GuildEmoji = ({ id, emoji, index, moveCard }: CardProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null)
  const [{ handlerId }, drop] = useDrop<DragItem, void, { readonly handlerId: Identifier | null }>({
    accept: emojiType,
    collect: monitor => ({ handlerId: monitor.getHandlerId() }),
    hover: (item: DragItem, monitor) => {
      if (ref.current === null) return
      const dragIndex = item.index
      const hoverIndex = index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) return

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect()

      // Get horizontal center
      const hoverCenterX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()

      // Get pixels to the left
      const hoverClientX = (clientOffset as XYCoord).x - hoverBoundingRect.left

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientX < hoverCenterX) return

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientX > hoverCenterX) return

      // Time to actually perform the action
      moveCard(dragIndex, hoverIndex)

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      // eslint-disable-next-line functional/immutable-data
      item.index = hoverIndex
    },
  })

  const [{ isDragging }, drag] = useDrag({
    type: emojiType,
    item: () => ({ id, index }),
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  })

  const opacity = isDragging ? 0 : 1

  drag(drop(ref))

  return (
    <div ref={ref} data-handler-id={handlerId}>
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
          className="object-contain w-28 h-28 border border-gray1"
          style={{ opacity }}
        />
      </Tooltip>
    </div>
  )
}
