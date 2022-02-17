import { GuildMember } from 'discord.js'
import type { Interaction } from 'discord.js'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

export type InteractionAuthor = Newtype<{ readonly InteractionAuthor: unique symbol }, string>

const { wrap, unwrap } = iso<InteractionAuthor>()

const fromInteraction = ({ user, member }: Interaction): InteractionAuthor => {
  if (member === null) return wrap(user.tag)

  if (member instanceof GuildMember) return wrap(member.displayName)

  return wrap(member.user.username)
}

export const InteractionAuthor = { fromInteraction, unwrap }
