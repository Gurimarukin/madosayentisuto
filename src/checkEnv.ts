import { Config } from './config/Config'
import { Do, Future } from './utils/fp'

const main = (): Future<unknown> =>
  Do(Future.taskEitherSeq)
    // check config
    .do(Future.fromIOEither(Config.load()))
    .done()

Future.runUnsafe(main())
