import { pipe } from 'fp-ts/function'

import { Future } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import type { MadEventAppStarted, MadEventDbReady } from '../../models/event/MadEvent'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { TObserver } from '../../models/rx/TObserver'
import type { TSubject } from '../../models/rx/TSubject'
import { FutureUtils } from '../../utils/FutureUtils'

export const IndexesEnsureObserver = (
  Logger: LoggerGetter,
  subject: TSubject<MadEventDbReady>,
  ensureIndexes: Future<void>,
): TObserver<MadEventAppStarted> => {
  const logger = Logger('IndexesEnsureObserver')

  return {
    next: () =>
      pipe(
        logger.info('Ensuring indexes'),
        Future.fromIOEither,
        Future.chain(() => ensureIndexes),
        FutureUtils.retryIfFailed(constants.retryEnsuringIndexes, {
          onFailure: e => logger.error('Failed to ensure indexes:\n', e),
          onSuccess: () => logger.info('Ensured indexes'),
        }),
        Future.chainIOEitherK(() => subject.next(MadEvent.DbReady())),
      ),
  }
}
