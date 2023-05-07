import type { User } from 'discord.js'
import { pipe } from 'fp-ts/function'

import type { Track } from '../../../shared/models/audio/music/Track'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type {
  AudioStateValueElevator,
  AudioStateValueMusic,
} from '../../models/audio/AudioStateValue'

const tracksAdded = (author: User, tracks: NonEmptyArray<Track>): string => {
  const tracksStr = ((): string => {
    if (tracks.length === 1) {
      const head = NonEmptyArray.head(tracks)
      return ` [${head.title}](${head.url})`
    }
    return pipe(
      tracks,
      List.map(t => `• [${t.title}](${t.url})`),
      List.mkString('\n', '\n', ''),
    )
  })()
  return `**${author}** a ajouté${tracksStr}`
}

const trackSkipped = (author: User, value: AudioStateValueMusic): string => {
  const additional = pipe(
    value.currentTrack,
    Maybe.fold(
      () => '',
      t => `...\n*...et a interrompu [${t.title}](${t.url})*`,
    ),
  )
  return `**${author}** est passé au morceau suivant${additional}`
}

const elevatorStarted = (author: User): string => `**${author}** a appelé l’ascenseur`

const elevatorSkipped = (author: User, { playlist: [head] }: AudioStateValueElevator): string =>
  `**${author}** a interrompu \`${head.basename}\`.`

export const PlayerEventMessage = { tracksAdded, trackSkipped, elevatorStarted, elevatorSkipped }
