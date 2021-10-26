import { pipe } from 'fp-ts/function'

import { globalConfig } from '../globalConfig'
import { MadEvent } from '../models/MadEvent'
import { ObserverE } from '../models/ObserverE'
import { Future, IO, List } from '../utils/fp'
import { FutureUtils } from '../utils/FutureUtils'
import { PartialLogger } from './Logger'
import { PubSub } from './PubSub'

export const IndexesEnsureObserver = (
  Logger: PartialLogger,
  pubSub: PubSub<MadEvent>,
  ensureIndexes: List<() => Future<void>>,
): ObserverE<MadEvent> => {
  const logger = Logger('IndexesEnsureObserver')
  return {
    next: event => {
      if (event.type === 'AppStarted') {
        return pipe(
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
          Future.chain(() => Future.fromIOEither(pubSub.publish(MadEvent.IndexesEnsured))),
          IO.runFuture,
        )
      }
      return IO.unit
    },
  }
}
