import { ClientEvents } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { MadEvent } from '../../models/MadEvent'
import { IO } from '../../utils/fp'
import { DiscordConnector } from '../DiscordConnector'
import { PubSub } from '../PubSub'

export const publishDiscordEvents = (
  pubSub: PubSub<MadEvent>,
  discord: DiscordConnector,
): IO<void> => {
  return pipe(
    IO.sequenceArray([
      publishOn('guildMemberAdd', MadEvent.GuildMemberAdd),
      publishOn('guildMemberRemove', MadEvent.GuildMemberRemove),
      publishOn('guildBanAdd', MadEvent.GuildBanAdd),
    ]),
    IO.map(() => {}),
  )

  function publishOn<K extends keyof ClientEvents>(
    event: K,
    getMad: (...args: ClientEvents[K]) => MadEvent,
  ): IO<void> {
    return pipe(
      IO.tryCatch(() =>
        discord.client.on(event, (...args) => pipe(pubSub.publish(getMad(...args)), IO.runUnsafe)),
      ),
      IO.map(() => {}),
    )
  }
}
