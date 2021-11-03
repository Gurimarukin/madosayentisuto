import { pipe } from 'fp-ts/function'

import { globalConfig } from '../../globalConfig'
import { AppStarted, DbReady, MadEvent } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { TSubject } from '../../models/TSubject'
import { Future, List } from '../../utils/fp'
import { FutureUtils } from '../../utils/FutureUtils'
import { PartialLogger } from '../Logger'

export const IndexesEnsureObserver = (
  Logger: PartialLogger,
  subject: TSubject<DbReady>,
  ensureIndexes: List<() => Future<void>>,
): TObserver<AppStarted> => {
  const logger = Logger('IndexesEnsureObserver')

  return {
    next: () =>
      pipe(
        Future.fromIOEither(logger.info('Ensuring indexes')),
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
