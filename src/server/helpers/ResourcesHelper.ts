import type { AudioResource } from '@discordjs/voice'
import { StreamType, createAudioResource } from '@discordjs/voice'
import { io } from 'fp-ts'

import { RandomUtils } from '../../shared/utils/RandomUtils'
import type { NonEmptyArray } from '../../shared/utils/fp'

import type { Resources } from '../config/Resources'
import type { MyFile } from '../models/FileOrDir'
import type { PlaylistType } from '../models/audio/PlaylistType'

export type ResourcesHelper = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (resources: Resources) => {
  const randomElevatorPlaylist: io.IO<NonEmptyArray<MyFile>> = RandomUtils.shuffle(
    resources.music.elevator,
  )

  return { playlistFiles }

  function playlistFiles(type: PlaylistType): io.IO<NonEmptyArray<MyFile>> {
    switch (type) {
      case 'elevator':
        return randomElevatorPlaylist
      case 'heimerLoco':
        return io.of(resources.music.heimerLoco)
    }
  }
}

const audioResourceFromOggFile = (file: MyFile): AudioResource =>
  createAudioResource(file.path, { inputType: StreamType.OggOpus })

export const ResourcesHelper = { of, audioResourceFromOggFile }
