import { GuildMember } from 'discord.js'

export type GuildMemberEvent = GuildMemberEvent.Add | GuildMemberEvent.Remove

export namespace GuildMemberEvent {
  export interface Add {
    _tag: 'Add'
    member: GuildMember
  }
  export const Add = (member: GuildMember): GuildMemberEvent => ({ _tag: 'Add', member })

  export interface Remove {
    _tag: 'Remove'
    member: GuildMember
  }
  export const Remove = (member: GuildMember): GuildMemberEvent => ({ _tag: 'Remove', member })

  export const fold = <A>({ onAdd, onRemove }: FoldArgs<A>) => (event: GuildMemberEvent): A => {
    switch (event._tag) {
      case 'Add':
        return onAdd(event.member)
      case 'Remove':
        return onRemove(event.member)
    }
  }
}

interface FoldArgs<A> {
  onAdd: (member: GuildMember) => A
  onRemove: (member: GuildMember) => A
}