import { Config } from './config/Config'
import { YoutubeDlService } from './services/YoutubeDlService'
import { Future, Do } from './utils/fp'

const main = (): Future<unknown> =>
  Do(Future.taskEitherSeq)
    .do(Future.fromIOEither(Config.load()))
    .do(YoutubeDlService.version())
    .done()

Future.runUnsafe(main())
