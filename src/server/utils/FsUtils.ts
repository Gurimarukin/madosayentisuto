import { pipe } from 'fp-ts/function'
import fs from 'fs'

import { Future, IO, List, Maybe } from '../../shared/utils/fp'

import type { MyFile } from '../models/FileOrDir'
import { Dir, FileOrDir } from '../models/FileOrDir'

const stat = (f: FileOrDir): Future<Maybe<fs.Stats>> =>
  pipe(
    Future.tryCatch(() => fs.promises.stat(f.path)),
    Future.map(Maybe.some),
    Future.orElse(() => Future.right<Maybe<fs.Stats>>(Maybe.none)),
  )

const chdir = (dir: Dir): IO<void> => IO.tryCatch(() => process.chdir(dir.path))

const copyFile = (src: FileOrDir, dest: FileOrDir, flags?: number): Future<void> =>
  Future.tryCatch(() => fs.promises.copyFile(src.path, dest.path, flags))

const cwd = (): IO<Dir> =>
  pipe(
    IO.tryCatch(() => process.cwd()),
    IO.map(Dir.of),
  )

const exists = (f: FileOrDir): Future<boolean> => pipe(stat(f), Future.map(Maybe.isSome))

const mkdir = (dir: Dir, options?: fs.MakeDirectoryOptions): Future<void> =>
  pipe(
    Future.tryCatch(() => fs.promises.mkdir(dir.path, options)),
    Future.map(() => undefined),
  )

const readdir = (dir: Dir): Future<List<FileOrDir>> =>
  pipe(
    Future.tryCatch(() => fs.promises.readdir(dir.path, { withFileTypes: true })),
    Future.map(List.map(FileOrDir.fromDirent(dir))),
  )

const readFile = (file: MyFile): Future<string> =>
  Future.tryCatch(() => fs.promises.readFile(file.path, { encoding: 'utf-8' }))

const readFileSync = (path: string): IO<string> => IO.tryCatch(() => fs.readFileSync(path, 'utf8'))

function rename(oldF: MyFile, newF: MyFile): Future<void>
function rename(oldF: Dir, newF: Dir): Future<void>
function rename(oldF: FileOrDir, newF: FileOrDir): Future<void> {
  return Future.tryCatch(() => fs.promises.rename(oldF.path, newF.path))
}

const rmdir = (dir: Dir, options?: fs.RmDirOptions): Future<void> =>
  Future.tryCatch(() => fs.promises.rmdir(dir.path, options))

export const FsUtils = {
  stat,
  chdir,
  copyFile,
  cwd,
  exists,
  mkdir,
  readdir,
  readFile,
  readFileSync,
  rename,
  rmdir,
}
