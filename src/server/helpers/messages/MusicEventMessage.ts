import type { User } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { AudioState } from '../../models/audio/AudioState'
import type { Track } from '../../models/audio/music/Track'

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

const trackSkipped = (author: User, state: AudioState): string => {
  const additional = pipe(
    state,
    AudioState.value.Music.currentTrack.get,
    Maybe.fold(
      () => '',
      t => `...\n*...et a interrompu [${t.title}](${t.url})*`,
    ),
  )
  return `**${author}** est passé au morceau suivant${additional}`
}

export const MusicEventMessage = { tracksAdded, trackSkipped }
