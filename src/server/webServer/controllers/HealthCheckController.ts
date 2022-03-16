import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import type { HealthCheckService } from '../../services/HealthCheckService'
import { EndedMiddleware } from '../models/EndedMiddleware'

export type HealthCheckController = ReturnType<typeof HealthCheckController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const HealthCheckController = (healthCheckService: HealthCheckService) => {
  const check: EndedMiddleware = pipe(
    EndedMiddleware.fromTaskEither(healthCheckService.check()),
    EndedMiddleware.ichain(ok =>
      ok ? EndedMiddleware.text(Status.OK)() : EndedMiddleware.text(Status.InternalServerError)(),
    ),
  )

  return { check }
}
