import type { ClientEvents } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { IO } from '../../shared/utils/fp'

import { MadEvent } from '../models/events/MadEvent'
import type { TSubject } from '../models/rx/TSubject'
import { publishOn } from '../utils/publishOn'
import type { DiscordConnector } from './DiscordConnector'

export const publishDiscordEvents = (
  discord: DiscordConnector,
  subject: TSubject<MadEvent>,
): IO<void> => {
  const pub = publishOn<keyof ClientEvents, ClientEvents, MadEvent>(discord.client.on, subject.next)

  return pipe(
    IO.sequenceArray([
      pub('guildMemberAdd', MadEvent.GuildMemberAdd),
      pub('guildMemberRemove', MadEvent.GuildMemberRemove),
      pub('interactionCreate', MadEvent.InteractionCreate),
      pub('messageCreate', MadEvent.MessageCreate),
      pub('voiceStateUpdate', MadEvent.VoiceStateUpdate),
      // pub('messageReactionAdd', MadEvent.MessageReactionAdd),
      // pub('messageReactionRemove', MadEvent.MessageReactionRemove),
    ]),
    IO.map(() => {}),
  )
}
