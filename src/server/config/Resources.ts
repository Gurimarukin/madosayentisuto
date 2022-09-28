import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import type { MyFile } from '../models/FileOrDir'
import { FileOrDir } from '../models/FileOrDir'
import { Dir } from '../models/FileOrDir'
import { FsUtils } from '../utils/FsUtils'

export type Resources = {
  readonly music: {
    readonly elevator: NonEmptyArray<MyFile>
  }
}

const resourcesDir = pipe(Dir.of(__dirname), Dir.joinDir('..', '..', '..', 'resources'))

const loadDir = (dir: Dir): Future<NonEmptyArray<MyFile>> =>
  pipe(
    FsUtils.readdir(dir),
    Future.chain(
      flow(
        List.filter(FileOrDir.isFile),
        NonEmptyArray.fromReadonlyArray,
        Future.fromOption(() => Error(`No file found in directory: ${dir.path}`)),
      ),
    ),
  )

const load: Future<Resources> = pipe(
  apply.sequenceS(Future.ApplicativePar)({
    music: apply.sequenceS(Future.ApplicativePar)({
      elevator: loadDir(pipe(resourcesDir, Dir.joinDir('music', 'elevator'))),
    }),
  }),
)

export const Resources = { load }
