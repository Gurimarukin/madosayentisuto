import { identity, pipe } from 'fp-ts/function'

import { StringUtils } from '../../../shared/utils/StringUtils'
import { Future } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import type { MadEventDbReady } from '../../models/event/MadEvent'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import type { TSubject } from '../../models/rx/TSubject'
import type { HealthCheckService } from '../../services/HealthCheckService'
import type { MigrationService } from '../../services/MigrationService'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const EnsureDbReadyObserver = (
  Logger: LoggerGetter,
  subject: TSubject<MadEventDbReady>,
  healthCheckService: HealthCheckService,
  migrationService: MigrationService,
  ensureIndexes: Future<void>,
) => {
  const logger = Logger('EnsureDbReadyObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AppStarted',
  )(() =>
    pipe(
      logger.info('Ensuring indexes'),
      Future.fromIOEither,
      Future.chain(() => waitDatabaseReady()),
      Future.chain(() => migrationService.applyMigrations),
      Future.chain(() => ensureIndexes),
      Future.chainIOEitherK(() => logger.info('Ensured indexes')),
      Future.chainIOEitherK(() => subject.next(MadEvent.DbReady())),
    ),
  )

  function waitDatabaseReady(): Future<boolean> {
    return pipe(
      healthCheckService.check(),
      Future.orElse(() =>
        pipe(
          logger.info(
            `Couldn't connect to mongo, waiting ${StringUtils.prettyMs(
              constants.retryEnsuringIndexes,
            )} before next try`,
          ),
          Future.fromIOEither,
          Future.chain(() =>
            pipe(waitDatabaseReady(), Future.delay(constants.retryEnsuringIndexes)),
          ),
        ),
      ),
      Future.filterOrElse(identity, () => Error("HealthCheck wasn't success")),
    )
  }
}
