import { Message, VoiceConnection } from 'discord.js'

import { GuildId } from '../../models/GuildId'
import { TrackMetadata } from '../../models/TrackMetadata'
import { readonly } from 'io-ts'

export type PlayerAction =
  | PlayerAction.SetLock
  | PlayerAction.DeleteMessage
  | PlayerAction.SetConnection
  | PlayerAction.Enqueue

export namespace PlayerAction {
  export interface SetLock {
    readonly type: 'SetLock'
    readonly guildId: GuildId
    readonly message: Message
  }
  export const SetLock = (guildId: GuildId, message: Message): SetLock => ({
    type: 'SetLock',
    guildId,
    message
  })

  export interface DeleteMessage {
    readonly type: 'DeleteMessage'
    readonly guildId: GuildId
  }
  export const DeleteMessage = (guildId: GuildId): DeleteMessage => ({
    type: 'DeleteMessage',
    guildId
  })

  export interface SetConnection {
    readonly type: 'SetConnection'
    readonly guildId: GuildId
    readonly connection: VoiceConnection
  }
  export const SetConnection = (guildId: GuildId, connection: VoiceConnection): SetConnection => ({
    type: 'SetConnection',
    guildId,
    connection
  })

  export interface Enqueue {
    readonly type: 'Enqueue'
    readonly guildId: GuildId
    readonly metadata: TrackMetadata
  }
  export const Enqueue = (guildId: GuildId, metadata: TrackMetadata): Enqueue => ({
    type: 'Enqueue',
    guildId,
    metadata
  })
}
