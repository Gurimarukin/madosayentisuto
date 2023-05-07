import { eq, string } from 'fp-ts'
import type { Eq } from 'fp-ts/Eq'
import { pipe } from 'fp-ts/function'
import type fs from 'fs'
import nodePath from 'path'

import type { List } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'

export type FileOrDir = MyFile | Dir

export type MyFile = {
  _tag: 'File'
  path: string
  basename: string
  dirname: string
}

export type Dir = {
  _tag: 'Dir'
  path: string
}

export const FileOrDir = {
  isFile: (f: FileOrDir): f is MyFile => f._tag === 'File',
  isDir: (f: FileOrDir): f is Dir => f._tag === 'Dir',
  fromDirent:
    (parent: Dir) =>
    (f: fs.Dirent): FileOrDir => {
      const path = nodePath.join(parent.path, f.name)
      return f.isDirectory()
        ? Dir.of(path)
        : MyFile.of({ path, basename: f.name, dirname: parent.path })
    },
}

const myFileFromPath = (path: string): MyFile =>
  MyFile.of({
    path,
    basename: nodePath.basename(path),
    dirname: nodePath.dirname(path),
  })

const myFileEq: Eq<MyFile> = pipe(
  string.Eq,
  eq.contramap(f => f.path),
)

export const MyFile = {
  of: ({ path, basename, dirname }: Omit<MyFile, '_tag'>): MyFile => ({
    _tag: 'File',
    path,
    basename,
    dirname,
  }),

  fromPath: myFileFromPath,

  setBasename:
    (basename: string) =>
    (file: MyFile): MyFile =>
      myFileFromPath(nodePath.join(file.dirname, basename)),

  stringify: ({ path, basename, dirname }: MyFile): string =>
    `File(${path}, ${basename}, ${dirname})`,

  Eq: myFileEq,
}

const dirOf = (path: string): Dir => ({ _tag: 'Dir', path })

export const Dir = {
  of: dirOf,

  resolveDir:
    (path: string, ...paths: List<string>) =>
    (dir: Dir): IO<Dir> =>
      pipe(
        IO.tryCatch(() => nodePath.resolve(dir.path, path, ...paths)),
        IO.map(dirOf),
      ),

  joinDir:
    (path: string, ...paths: List<string>) =>
    (dir: Dir): Dir =>
      dirOf(nodePath.join(dir.path, path, ...paths)),

  joinFile:
    (path: string, ...paths: List<string>) =>
    (dir: Dir): MyFile =>
      MyFile.fromPath(nodePath.join(dir.path, path, ...paths)),
}
