import type { ClientEvents } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import type { LoggerType } from '../../shared/models/LoggerType'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { LogUtils } from '../../shared/utils/LogUtils'
import type { ToTiny } from '../../shared/utils/PubSubUtils'
import { PubSubUtils } from '../../shared/utils/PubSubUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { IO, List, toNotUsed } from '../../shared/utils/fp'

import { MadEvent } from '../models/event/MadEvent'
import type { DiscordConnector } from './DiscordConnector'

export const publishDiscordEvents = (
  logger: LoggerType,
  discord: DiscordConnector,
  subject: TSubject<MadEvent>,
): IO<NotUsed> => {
  const pub = PubSubUtils.publish(LogUtils.onError(logger))(subject.next)('on')<
    ToTiny<ClientEvents>
  >(discord.client)

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      pub('guildMemberAdd', MadEvent.GuildMemberAdd),
      pub('guildMemberRemove', MadEvent.GuildMemberRemove),
      pub('interactionCreate', MadEvent.InteractionCreate),
      pub('messageCreate', MadEvent.MessageCreate),
      pub('messageDelete', flow(List.of, MadEvent.MessageDelete)),
      pub('messageDeleteBulk', coll => MadEvent.MessageDelete(coll.toJSON())),
      pub('voiceStateUpdate', MadEvent.VoiceStateUpdate),

      // pub('messageReactionAdd', MadEvent.MessageReactionAdd),
      // pub('messageReactionRemove', MadEvent.MessageReactionRemove),
    ),
    IO.map(toNotUsed),
  )
}
