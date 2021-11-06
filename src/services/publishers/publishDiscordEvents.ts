import { ClientEvents } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { MadEvent } from '../../models/MadEvent'
import { TSubject } from '../../models/TSubject'
import { IO } from '../../utils/fp'
import { DiscordConnector } from '../DiscordConnector'

export const publishDiscordEvents = (
  discord: DiscordConnector,
  subject: TSubject<MadEvent>,
): IO<void> => {
  return pipe(
    IO.sequenceArray([
      publishOn('guildMemberAdd', MadEvent.GuildMemberAdd),
      publishOn('guildMemberRemove', MadEvent.GuildMemberRemove),
      publishOn('interactionCreate', MadEvent.InteractionCreate),
      publishOn('messageCreate', MadEvent.MessageCreate),
      publishOn('voiceStateUpdate', MadEvent.VoiceStateUpdate),
      // publishOn('messageReactionAdd', MadEvent.MessageReactionAdd),
      // publishOn('messageReactionRemove', MadEvent.MessageReactionRemove),
    ]),
    IO.map(() => {}),
  )

  function publishOn<K extends keyof ClientEvents>(
    event: K,
    getMad: (...args: ClientEvents[K]) => MadEvent,
  ): IO<void> {
    return pipe(
      IO.tryCatch(() =>
        discord.client.on(event, (...args) => pipe(subject.next(getMad(...args)), IO.runUnsafe)),
      ),
      IO.map(() => {}),
    )
  }
}
