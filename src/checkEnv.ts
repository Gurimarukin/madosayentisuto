import { Config } from './config/Config'
import { PlayerService } from './services/PlayerService'
import { Future, Do } from './utils/fp'

const main = (): Future<unknown> =>
  Do(Future.taskEitherSeq)
    .do(Future.fromIOEither(Config.load()))
    .do(PlayerService.youtubeDlVersion())
    .done()

Future.runUnsafe(main())
