import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'
import type { Db } from 'mongodb'

import { Either, Future } from '../../shared/utils/fp'

const ResultCodec = D.struct({ ok: D.number })

export type HealthCheckPersistence = ReturnType<typeof HealthCheckPersistence>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const HealthCheckPersistence = (withDb: <A>(f: (db: Db) => Promise<A>) => Future<A>) => ({
  check: (): Future<boolean> =>
    pipe(
      withDb(db => db.command({ ping: 1 })),
      Future.map(res => {
        const decoded = ResultCodec.decode(res)
        return Either.isRight(decoded) && decoded.right.ok === 1
      }),
    ),
})
