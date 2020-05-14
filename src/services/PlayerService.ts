import { Future, pipe, todo, NonEmptyArray } from '../utils/fp'
import { ProcessUtils } from '../utils/ProcessUtils'

export type PlayerService = ReturnType<typeof PlayerService>

export function PlayerService() {
  return {
    play: (tracks: NonEmptyArray<string>): Future<unknown> => todo(tracks)
  }
}

export namespace PlayerService {
  export const youtubeDlVersion = (): Future<string> =>
    pipe(
      ProcessUtils.execAsync('youtube-dl', ['--version']),
      Future.chain(o => (o.code === 0 ? Future.right(o.stdout) : Future.left(Error(o.stderr))))
    )
}
