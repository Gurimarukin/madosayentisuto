import { Future, pipe } from '../utils/fp'
import { ProcessUtils } from '../utils/ProcessUtils'

export type YoutubeDlService = ReturnType<typeof YoutubeDlService>

export function YoutubeDlService() {}

export namespace YoutubeDlService {
  export const version = (): Future<string> =>
    pipe(
      ProcessUtils.execAsync('youtube-dl', ['--version']),
      Future.chain(o => (o.code === 0 ? Future.right(o.stdout) : Future.left(Error(o.stderr))))
    )
}
