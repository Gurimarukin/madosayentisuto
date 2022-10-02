import type { AudioResource } from '@discordjs/voice'
import { createAudioResource, demuxProbe } from '@discordjs/voice'
import { io, random } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import fs from 'fs'

import { Future, Maybe } from '../../shared/utils/fp'

import type { Resources } from '../config/Resources'
import { MyFile } from '../models/FileOrDir'

export type ResourcesHelper = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (resources: Resources) => {
  return { randomElevatorMusic }

  function randomElevatorMusic(maybePrevious: Maybe<MyFile>): io.IO<MyFile> {
    return pipe(
      maybePrevious,
      Maybe.filter(() => 1 < resources.music.elevator.length),
      Maybe.fold(() => random.randomElem(resources.music.elevator), randomElevatorMusicRec),
    )
  }

  function randomElevatorMusicRec(previous: MyFile): io.IO<MyFile> {
    return pipe(
      random.randomElem(resources.music.elevator),
      io.chain(file =>
        MyFile.Eq.equals(file, previous) ? randomElevatorMusicRec(previous) : io.of(file),
      ),
    )
  }
}

const audioResourceFromFile = (file: MyFile): Future<AudioResource> =>
  pipe(
    Future.tryCatch(() => demuxProbe(fs.createReadStream(file.path))),
    Future.map(probe => createAudioResource(probe.stream, { inputType: probe.type })),
  )

export const ResourcesHelper = { of, audioResourceFromFile }
