import type { ClientEvents } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { IO } from '../../shared/utils/fp'

import { MadEvent } from '../models/events/MadEvent'
import type { TSubject } from '../models/rx/TSubject'
import type { ToTiny } from '../utils/PubSubUtils'
import { PubSubUtils } from '../utils/PubSubUtils'
import type { DiscordConnector } from './DiscordConnector'

export const publishDiscordEvents = (
  discord: DiscordConnector,
  subject: TSubject<MadEvent>,
): IO<void> => {
  const pub = PubSubUtils.publishOn<ToTiny<ClientEvents>, MadEvent>(discord.client, subject.next)

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      pub('guildMemberAdd', MadEvent.GuildMemberAdd),
      pub('guildMemberRemove', MadEvent.GuildMemberRemove),
      pub('interactionCreate', MadEvent.InteractionCreate),
      pub('messageCreate', MadEvent.MessageCreate),
      pub('voiceStateUpdate', MadEvent.VoiceStateUpdate),

      // pub('messageReactionAdd', MadEvent.MessageReactionAdd),
      // pub('messageReactionRemove', MadEvent.MessageReactionRemove),
    ),
    IO.map(() => {}),
  )
}
