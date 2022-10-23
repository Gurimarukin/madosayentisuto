import type { AudioResource } from '@discordjs/voice'
import { createAudioResource, demuxProbe } from '@discordjs/voice'
import type { io } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import fs from 'fs'

import { RandomUtils } from '../../shared/utils/RandomUtils'
import type { NonEmptyArray } from '../../shared/utils/fp'
import { Future } from '../../shared/utils/fp'

import type { Resources } from '../config/Resources'
import type { MyFile } from '../models/FileOrDir'

export type ResourcesHelper = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (resources: Resources) => {
  const randomElevatorPlaylist: io.IO<NonEmptyArray<MyFile>> = RandomUtils.shuffle(
    resources.music.elevator,
  )

  return { randomElevatorPlaylist }
}

const audioResourceFromFile = (file: MyFile): Future<AudioResource> =>
  pipe(
    Future.tryCatch(() => demuxProbe(fs.createReadStream(file.path))),
    Future.map(probe => createAudioResource(probe.stream, { inputType: probe.type })),
  )

export const ResourcesHelper = { of, audioResourceFromFile }
