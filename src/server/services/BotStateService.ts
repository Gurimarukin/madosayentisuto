import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Future, IO, Maybe, toUnit } from '../../shared/utils/fp'

import type { DiscordConnector } from '../helpers/DiscordConnector'
import type { Activity } from '../models/botState/Activity'
import type { BotState } from '../models/botState/BotState'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { BotStatePersistence } from '../persistence/BotStatePersistence'

export type BotStateService = ReturnType<typeof BotStateService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const BotStateService = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  botStatePersistence: BotStatePersistence,
) => {
  const logger = Logger('BotStateService')

  const { find } = botStatePersistence

  return {
    discordSetActivity,

    discordSetActivityFromDb: (): Future<BotState> =>
      pipe(
        find(),
        Future.chainFirst(({ activity }) => discordSetActivity(activity)),
      ),

    find,

    unsetActivity: (): Future<BotState> => setActivity(Maybe.none),

    setActivity: (activity: Activity): Future<BotState> => setActivity(Maybe.some(activity)),
  }

  function discordSetActivity(maybeActivity: Maybe<Activity>): Future<void> {
    return pipe(
      maybeActivity,
      Maybe.fold(
        () => logger.info('Unsetting activity'),
        activity => logger.info(`Setting activity: ${activity.type} ${activity.name}`),
      ),
      IO.chain(() => discord.setActivity(maybeActivity)),
      IO.map(toUnit),
      Future.fromIOEither,
    )
  }

  function setActivity(activity: Maybe<Activity>): Future<BotState> {
    return pipe(
      botStatePersistence.find(),
      Future.map(state => ({ ...state, activity })),
      Future.chainFirst(newState =>
        apply.sequenceT(Future.ApplyPar)(
          discordSetActivity(activity),
          botStatePersistence.upsert(newState),
        ),
      ),
    )
  }

  // function updateStateDb(update: (s: BotState) => BotState): Future<BotState> {
  //   return pipe(
  //     botStatePersistence.find(),
  //     Future.map(update),
  //     Future.chainFirst(newState => botStatePersistence.upsert(newState)),
  //   )
  // }
}
