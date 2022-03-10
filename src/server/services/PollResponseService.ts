import type { PollResponsePersistence } from '../persistence/PollResponsePersistence'

export type PollResponseService = ReturnType<typeof PollResponseService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollResponseService = (pollResponsePersistence: PollResponsePersistence) => {
  const { lookupByUser, listForMessage, upsert } = pollResponsePersistence

  return { lookupByUser, listForMessage, upsert }
}
