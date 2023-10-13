import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import path from 'path'
import { fileURLToPath } from 'url'
import type { MyFile } from '../models/FileOrDir'
import { Dir, FileOrDir } from '../models/FileOrDir'
import { FsUtils } from '../utils/FsUtils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const musicExtension = /\.(ogg|webm)$/

type Resources = {
  music: {
    elevator: NonEmptyArray<MyFile>
  }
}

const resourcesDir = pipe(Dir.of(__dirname), Dir.joinDir('..', '..', '..', 'resources'))

const loadDir = (dir: Dir): Future<NonEmptyArray<MyFile>> =>
  pipe(
    FsUtils.readdir(dir),
    Future.chain(
      flow(
        List.filter(isMusicFile),
        NonEmptyArray.fromReadonlyArray,
        Future.fromOption(() => Error(`No file found in directory: ${dir.path}`)),
      ),
    ),
  )

const isMusicFile = (f: FileOrDir): f is MyFile =>
  FileOrDir.isFile(f) && musicExtension.test(f.basename)

const load: Future<Resources> = pipe(
  apply.sequenceS(Future.ApplicativePar)({
    music: apply.sequenceS(Future.ApplicativePar)({
      elevator: loadDir(pipe(resourcesDir, Dir.joinDir('music', 'elevator'))),
    }),
  }),
)

const Resources = { load }

export { Resources }
