import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, List } from '../../shared/utils/fp'

import type { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'

type UwURenamerObserver = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (discord: DiscordConnector) => {
  console.log('discord =', discord)
  const res = discord.client.guilds.valueOf().toJSON()[0]?.members

  return ObserverWithRefinement.fromNext(MadEvent, 'GuildMemberAdd')(event => Future.todo())
}

type IGuildMember = {
  readonly id: string
  readonly user: {
    readonly username: string
  }
  readonly nickname: string | null
}

const uwUOrOwORegex = /(uwu|owo)/i

const isValidUwU =
  (whitelisted: List<DiscordUserId>) =>
  ({ id, nickname }: IGuildMember): boolean =>
    pipe(whitelisted, List.elem(DiscordUserId.Eq)(DiscordUserId.wrap(id))) ||
    (nickname !== null && uwUOrOwORegex.test(StringUtils.cleanUTF8ToASCII(nickname)))

const UwURenamerObserver = { of, isValidUwU }

export { UwURenamerObserver }
