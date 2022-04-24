import type { ScheduledEventPersistence } from '../persistence/ScheduledEventPersistence'

export type ScheduledEventService = ReturnType<typeof ScheduledEventService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ScheduledEventService = (scheduledEventPersistence: ScheduledEventPersistence) => ({
  listBeforeDate: scheduledEventPersistence.listBeforeDate,
  create: scheduledEventPersistence.create,
  removeByIds: scheduledEventPersistence.removeByIds,
})
