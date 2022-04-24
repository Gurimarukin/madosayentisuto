import type { Future } from '../../shared/utils/fp'

import type { Reminder } from '../models/scheduledEvent/Reminder'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import type { ScheduledEventPersistence } from '../persistence/ScheduledEventPersistence'

export type ScheduledEventService = ReturnType<typeof ScheduledEventService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ScheduledEventService = (scheduledEventPersistence: ScheduledEventPersistence) => ({
  createReminder: (reminder: Reminder): Future<boolean> =>
    scheduledEventPersistence.create(ScheduledEvent.Reminder({ reminder })),
})
