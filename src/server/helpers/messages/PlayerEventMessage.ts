import type { User } from 'discord.js'
import { pipe } from 'fp-ts/function'

import type { Track } from '../../../shared/models/audio/music/Track'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import type {
  AudioStateValueMusic,
  AudioStateValuePlaylist,
} from '../../models/audio/AudioStateValue'
import type { PlaylistType } from '../../models/audio/PlaylistType'

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

const playlistStarted = (type: PlaylistType, author: User): string => {
  switch (type) {
    case 'elevator':
      return `**${author}** a appelé l’ascenseur`
    case 'heimerLoco':
      return `**${author}** JUGANDO HEIMERDONGER`
  }
}

const playlistSkipped = (
  type: PlaylistType,
  author: User,
  { files: [head] }: AudioStateValuePlaylist,
): string => {
  switch (type) {
    case 'elevator':
      return `**${author}** a interrompu \`${head.basename}\``
    case 'heimerLoco':
      return `**${author}** STOPIDA \`${head.basename}\``
  }
}

export const PlayerEventMessage = {
  tracksAdded,
  trackSkipped,
  playlistStarted,
  playlistSkipped,
}
