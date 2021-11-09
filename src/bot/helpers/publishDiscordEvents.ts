import type { DiscordConnector } from 'bot/helpers/DiscordConnector'
import { MadEvent } from 'bot/models/MadEvent'
import type { TSubject } from 'bot/models/rx/TSubject'
import type { ClientEvents } from 'discord.js'
import { pipe } from 'fp-ts/function'
import { IO } from 'shared/utils/fp'

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
