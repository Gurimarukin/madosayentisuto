import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import type { Dict } from '../../shared/utils/fp'
import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import type { MyFile } from '../models/FileOrDir'
import { Dir, FileOrDir } from '../models/FileOrDir'
import type { ChampionLevel } from '../models/theQuest/ChampionLevel'
import { FsUtils } from '../utils/FsUtils'

const musicExtension = /\.(ogg|webm)$/

type Resources = {
  mastery: Dict<`${ChampionLevel}`, MyFile>
  music: {
    elevator: NonEmptyArray<MyFile>
    heimerLoco: NonEmptyArray<MyFile>
  }
}

const resourcesDir = pipe(Dir.of(process.cwd()), Dir.joinDir('resources'))
const imgsDir = pipe(resourcesDir, Dir.joinDir('imgs'))
const musicDir = pipe(resourcesDir, Dir.joinDir('music'))

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

const load: Future<Resources> = apply.sequenceS(Future.ApplicativePar)({
  mastery: Future.successful({
    5: pipe(imgsDir, Dir.joinFile('mastery-5.png')),
    6: pipe(imgsDir, Dir.joinFile('mastery-6.png')),
    7: pipe(imgsDir, Dir.joinFile('mastery-7.png')),
  }),
  music: apply.sequenceS(Future.ApplicativePar)({
    elevator: loadDir(pipe(musicDir, Dir.joinDir('elevator'))),
    heimerLoco: loadDir(pipe(musicDir, Dir.joinDir('heimerLoco'))),
  }),
})

const Resources = { load }

export { Resources }
