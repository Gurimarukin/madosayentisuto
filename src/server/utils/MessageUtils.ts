import type { Message } from 'discord.js'
import { eq } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { MessageId } from '../../shared/models/MessageId'

const EqById: eq.Eq<Message> = pipe(MessageId.Eq, eq.contramap(MessageId.fromMessage))

export const MessageUtils = { EqById }
