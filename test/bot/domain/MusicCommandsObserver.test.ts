import { pipe } from 'fp-ts/function'

import { Either, Future, Maybe, NonEmptyArray } from '../../../src/shared/utils/fp'

import { validateTrack } from '../../../src/bot/domain/commands/MusicCommandsObserver'
import type { Track } from '../../../src/bot/models/music/Track'
import { StringUtils } from '../../../src/bot/utils/StringUtils'

describe('validateTrack', () => {
  const whenImTwi: Track = {
    title: "When i'm TWI !",
    url: 'https://www.youtube.com/watch?v=aeWfN6CinGY',
    thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/aeWfN6CinGY/maxresdefault.webp'),
  }
  const screamingMan: Track = {
    title: "YOU WON'T BELIEVE WHAT THIS SCREAMING MAN CAN DO !!",
    url: 'https://www.youtube.com/watch?v=psCSnnioq0M',
    thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/psCSnnioq0M/maxresdefault.webp'),
  }
  const myWorkIsDone: Track = {
    title: 'My work here is done',
    url: 'https://www.youtube.com/watch?v=0AfNhK9aCjo',
    thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/0AfNhK9aCjo/maxresdefault.webp'),
  }
  const sardoche: Track = {
    title: 'SARDOCHE LE NERVEUX',
    url: 'https://www.youtube.com/watch?v=IvKbpO0cMKM',
    thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/IvKbpO0cMKM/maxresdefault.webp'),
  }

  it('should validate YouTube video', () =>
    pipe(
      validateTrack('https://www.youtube.com/watch?v=aeWfN6CinGY'),
      Future.map(res => {
        expect(res).toStrictEqual(Either.right(NonEmptyArray.of(whenImTwi)))
      }),
      Future.runUnsafe,
    ))

  it('should validate YouTube video (short)', () =>
    pipe(
      validateTrack('https://youtu.be/aeWfN6CinGY'),
      Future.map(res => {
        expect(res).toStrictEqual(Either.right(NonEmptyArray.of(whenImTwi)))
      }),
      Future.runUnsafe,
    ))

  it('should validate YouTube playlist', () =>
    pipe(
      validateTrack('https://www.youtube.com/playlist?list=PLIbD1ba8REOOWyzNL1AEPQMpEflxjcOEL'),
      Future.map(res => {
        expect(res).toStrictEqual(Either.right([screamingMan, myWorkIsDone]))
      }),
      Future.runUnsafe,
    ))

  it('should search', () =>
    pipe(
      validateTrack('adedigado'),
      Future.map(res => {
        expect(res).toStrictEqual(Either.right(NonEmptyArray.of(sardoche)))
      }),
      Future.runUnsafe,
    ))

  it('should fail on invalid site', () =>
    validateTrack('https://dl.blbl.ch')().then(res => {
      expect(res).toStrictEqual(
        Either.left(
          Error(
            StringUtils.stripMargins(
              `Command failed with exit code 1: /Users/axelnussbaumer/perso/madosayentisuto/node_modules/youtube-dl-exec/bin/youtube-dl https://dl.blbl.ch --dump-single-json --default-search ytsearch
              |WARNING: Could not send HEAD request to https://dl.blbl.ch: HTTP Error 403: Forbidden
              |ERROR: Unable to download webpage: HTTP Error 403: Forbidden (caused by HTTPError()); please report this issue on https://yt-dl.org/bug . Make sure you are using the latest version; type  youtube-dl -U  to update. Be sure to call youtube-dl with the --verbose flag and include its complete output.`,
            ),
          ),
        ),
      )
    }))
})
