import { globalConfig } from 'bot/constants'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { AppStarted, DbReady } from 'bot/models/MadEvent'
import { MadEvent } from 'bot/models/MadEvent'
import type { TObserver } from 'bot/models/rx/TObserver'
import type { TSubject } from 'bot/models/rx/TSubject'
import { FutureUtils } from 'bot/utils/FutureUtils'
import { pipe } from 'fp-ts/function'
import type { List } from 'shared/utils/fp'
import { Future } from 'shared/utils/fp'

export const IndexesEnsureObserver = (
  Logger: LoggerGetter,
  subject: TSubject<DbReady>,
  ensureIndexes: List<() => Future<void>>,
): TObserver<AppStarted> => {
  const logger = Logger('IndexesEnsureObserver')

  return {
    next: () =>
      pipe(
        logger.info('Ensuring indexes'),
        Future.fromIOEither,
        Future.chain(() =>
          pipe(
            ensureIndexes,
            Future.traverseArray(f => f()),
            Future.map(() => {}),
          ),
        ),
        FutureUtils.retryIfFailed(globalConfig.retryEnsuringIndexes, {
          onFailure: e => logger.error('Failed to ensure indexes:\n', e),
          onSuccess: () => logger.info('Ensured indexes'),
        }),
        Future.chain(() => Future.fromIOEither(subject.next(MadEvent.DbReady))),
      ),
  }
}
