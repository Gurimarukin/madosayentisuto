import { pipe } from 'fp-ts/function'

import { Future } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import type { MadEventDbReady } from '../../models/event/MadEvent'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import type { TSubject } from '../../models/rx/TSubject'
import { FutureUtils } from '../../utils/FutureUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const IndexesEnsureObserver = (
  Logger: LoggerGetter,
  subject: TSubject<MadEventDbReady>,
  ensureIndexes: Future<void>,
) => {
  const logger = Logger('IndexesEnsureObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AppStarted',
  )(() =>
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
  )
}
