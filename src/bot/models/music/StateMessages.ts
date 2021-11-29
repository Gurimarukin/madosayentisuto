import type { Message } from 'discord.js'

export type StateMessages = {
  readonly playing: Message
  readonly queue: Message
}

const of = (playing: Message, queue: Message): StateMessages => ({ playing, queue })

export const StateMessages = { of }
