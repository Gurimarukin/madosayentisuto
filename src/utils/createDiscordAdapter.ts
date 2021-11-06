/**
 * source: https://github.com/discordjs/voice/blob/fa32cc2002f993d2212d0ba510c40fcf92ab7084/examples/basic/adapter.ts
 */

/* eslint-disable functional/no-expression-statement */
/* eslint-disable functional/no-return-void */
import { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from '@discordjs/voice'
import {
  GatewayVoiceServerUpdateDispatchData,
  GatewayVoiceStateUpdateDispatchData,
} from 'discord-api-types/v9'
import { Client, Constants, Guild, Snowflake, StageChannel, VoiceChannel } from 'discord.js'

const adapters = new Map<Snowflake, DiscordGatewayAdapterLibraryMethods>()
const trackedClients = new Set<Client>()

/**
 * Tracks a Discord.js client, listening to VOICE_SERVER_UPDATE and VOICE_STATE_UPDATE events
 *
 * @param client - The Discord.js Client to track
 */
function trackClient(client: Client): void {
  if (trackedClients.has(client)) return

  trackedClients.add(client)
  client.ws.on(
    Constants.WSEvents.VOICE_SERVER_UPDATE,
    (payload: GatewayVoiceServerUpdateDispatchData) => {
      adapters.get(payload.guild_id)?.onVoiceServerUpdate(payload)
    },
  )
  client.ws.on(
    Constants.WSEvents.VOICE_STATE_UPDATE,
    (payload: GatewayVoiceStateUpdateDispatchData) => {
      if (
        payload.guild_id !== undefined &&
        // payload.session_id &&
        payload.user_id === client.user?.id
      ) {
        adapters.get(payload.guild_id)?.onVoiceStateUpdate(payload)
      }
    },
  )
  client.on(Constants.Events.SHARD_DISCONNECT, (_, shardID) => {
    const guilds = trackedShards.get(shardID)
    if (guilds !== undefined) {
      // eslint-disable-next-line functional/no-loop-statement
      for (const guildID of guilds.values()) {
        adapters.get(guildID)?.destroy()
      }
    }
    trackedShards.delete(shardID)
  })
}

// eslint-disable-next-line functional/prefer-readonly-type
const trackedShards = new Map<number, Set<Snowflake>>()

function trackGuild(guild: Guild): void {
  const maybeGuild = trackedShards.get(guild.shardId)
  const guilds =
    maybeGuild ??
    (() => {
      const res = new Set<string>()
      trackedShards.set(guild.shardId, res)
      return res
    })()

  guilds.add(guild.id)
}

/**
 * Creates an adapter for a Voice Channel.
 *
 * @param channel - The channel to create the adapter for
 */
export function createDiscordAdapter(
  channel: VoiceChannel | StageChannel,
): DiscordGatewayAdapterCreator {
  return methods => {
    adapters.set(channel.guild.id, methods)
    trackClient(channel.client)
    trackGuild(channel.guild)
    return {
      sendPayload(data) {
        if (channel.guild.shard.status === Constants.Status.READY) {
          channel.guild.shard.send(data)
          return true
        }
        return false
      },
      destroy() {
        return adapters.delete(channel.guild.id)
      },
    }
  }
}
