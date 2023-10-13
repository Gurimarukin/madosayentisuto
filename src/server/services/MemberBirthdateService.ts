import { DayJs } from '../../shared/models/DayJs'
import type { DiscordUserId } from '../../shared/models/DiscordUserId'
import type { Future, List } from '../../shared/utils/fp'

import type { MemberBirthdate } from '../models/member/MemberBirthdate'
import type { MemberBirthdatePersistence } from '../persistence/MemberBirthdatePersistence'

export type MemberBirthdateService = ReturnType<typeof MemberBirthdateService>

export const MemberBirthdateService = ({
  listForMembers,
  remove,
  ...memberBirthdatePersistence // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
}: MemberBirthdatePersistence) => ({
  listForDate: (date: DayJs): Future<List<MemberBirthdate>> =>
    memberBirthdatePersistence.listForDate(startOfDay(date)),

  listForMembers,

  upsert: (id: DiscordUserId, birthdate: DayJs): Future<boolean> =>
    memberBirthdatePersistence.upsert({ id, birthdate: startOfDay(birthdate) }),

  remove,
})

const startOfDay: (date: DayJs) => DayJs = DayJs.startOf('day')
