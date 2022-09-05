import type {
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIMessageActionRowComponent,
  APIMessageComponentEmoji,
} from 'discord.js'
import { ButtonStyle } from 'discord.js'
import { resolvePartialEmoji } from 'discord.js'
import { ComponentType } from 'discord.js'

import { NonEmptyArray } from '../../../shared/utils/fp'

const row = (
  components: NonEmptyArray<APIMessageActionRowComponent>,
): APIActionRowComponent<APIMessageActionRowComponent> => ({
  type: ComponentType.ActionRow,
  components: NonEmptyArray.toMutable(components),
})

export type ButtonWithCustomIdOptions = {
  readonly custom_id: string
  readonly style?: Exclude<ButtonStyle, ButtonStyle.Link>
  readonly label?: string
  readonly emoji?: APIMessageComponentEmoji | string
  readonly disabled?: boolean
}

const buttonWithCustomId = ({
  style,
  emoji,
  ...options
}: ButtonWithCustomIdOptions): APIButtonComponentWithCustomId => ({
  type: ComponentType.Button,
  style: style ?? ButtonStyle.Secondary,
  emoji: resolveEmoji(emoji),
  ...options,
})

export const MessageComponent = { row, buttonWithCustomId }

const resolveEmoji = (
  emoji: APIMessageComponentEmoji | string | undefined,
): APIMessageComponentEmoji | undefined => {
  if (typeof emoji !== 'string') return emoji

  const parsed = resolvePartialEmoji(emoji)
  if (parsed === null) return undefined

  const { id, name, animated } = parsed
  return { id: id ?? undefined, name: name ?? undefined, animated }
}
