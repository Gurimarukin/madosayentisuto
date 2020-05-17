import { Config } from './config/Config'
import { Future, Do } from './utils/fp'

const main = (): Future<unknown> =>
  Do(Future.taskEitherSeq)
    // check config
    .do(Future.fromIOEither(Config.load()))
    .done()

Future.runUnsafe(main())
