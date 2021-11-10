import { pipe } from 'fp-ts/function'

import type { List } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'

import { globalConfig } from '../../constants'
import type { AppStarted, DbReady } from '../../models/MadEvent'
import { MadEvent } from '../../models/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { TObserver } from '../../models/rx/TObserver'
import type { TSubject } from '../../models/rx/TSubject'
import { FutureUtils } from '../../utils/FutureUtils'

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
