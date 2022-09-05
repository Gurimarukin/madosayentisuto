import { pipe } from 'fp-ts/function'

import type { LoggerType } from '../../../../src/shared/models/LoggerType'
import { MsDuration } from '../../../../src/shared/models/MsDuration'
import { Either, IO, Maybe, NonEmptyArray } from '../../../../src/shared/utils/fp'

import { Config } from '../../../../src/server/Config'
import { MusicCommandsObserver } from '../../../../src/server/domain/commands/MusicCommandsObserver'
import { YtDlp } from '../../../../src/server/helpers/YtDlp'
import { Track } from '../../../../src/server/models/music/Track'
import type { GuildStateService } from '../../../../src/server/services/GuildStateService'

describe('validateTracks', () => {
  const { ytDlpPath } = pipe(Config.load, IO.runUnsafe)

  const { validateTracks } = MusicCommandsObserver(
    () => ({} as LoggerType),
    YtDlp(ytDlpPath),
    {} as GuildStateService,
  )

  const whenImTwi: Track = Track.of(
    "When i'm TWI !",
    'https://www.youtube.com/watch?v=aeWfN6CinGY',
    Maybe.some('https://i.ytimg.com/vi_webp/aeWfN6CinGY/maxresdefault.webp'),
  )

  it('should validate YouTube video', () =>
    validateTracks('https://www.youtube.com/watch?v=aeWfN6CinGY')().then(res => {
      expect(res).toStrictEqual(Either.right(Either.right(NonEmptyArray.of(whenImTwi))))
    }))

  it('should validate YouTube video (short)', () =>
    validateTracks('https://youtu.be/aeWfN6CinGY')().then(res => {
      expect(res).toStrictEqual(Either.right(Either.right(NonEmptyArray.of(whenImTwi))))
    }))

  it('should validate YouTube playlist', () =>
    validateTracks(
      'https://www.youtube.com/playlist?list=PLIbD1ba8REOOWyzNL1AEPQMpEflxjcOEL',
    )().then(res => {
      expect(res).toStrictEqual(
        Either.right(
          Either.right([
            Track.of(
              "YOU WON'T BELIEVE WHAT THIS SCREAMING MAN CAN DO !!",
              'https://www.youtube.com/watch?v=psCSnnioq0M',
              Maybe.some('https://i.ytimg.com/vi_webp/psCSnnioq0M/maxresdefault.webp'),
            ),
            Track.of(
              'My work here is done',
              'https://www.youtube.com/watch?v=0AfNhK9aCjo',
              Maybe.some('https://i.ytimg.com/vi_webp/0AfNhK9aCjo/maxresdefault.webp'),
            ),
          ]),
        ),
      )
    }))

  it('should search', () =>
    validateTracks('sardoche le nerveux')().then(res => {
      expect(res).toStrictEqual(
        Either.right(
          Either.right(
            NonEmptyArray.of(
              Track.of(
                'SARDOCHE LE NERVEUX',
                'https://www.youtube.com/watch?v=IvKbpO0cMKM',
                Maybe.some('https://i.ytimg.com/vi_webp/IvKbpO0cMKM/maxresdefault.webp'),
              ),
            ),
          ),
        ),
      )
    }))

  it('should fail on invalid site', () =>
    validateTracks('https://dl.blbl.ch')().then(res => {
      expect(res).toStrictEqual(
        Either.left(
          Error(
            `Command failed with exit code 1: ${ytDlpPath} https://dl.blbl.ch --dump-single-json --default-search ytsearch --abort-on-error`,
          ),
        ),
      )
    }))

  it(
    'should validate Bandcamp album',
    () =>
      validateTracks('https://frayle.bandcamp.com/album/the-white-witch-ep')().then(res => {
        expect(res).toStrictEqual(
          Either.right(
            Either.right([
              Track.of(
                'Frayle - Let The Darkness In',
                'https://frayle.bandcamp.com/track/let-the-darkness-in-2',
                Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              ),
              Track.of(
                'Frayle - The White Witch',
                'https://frayle.bandcamp.com/track/the-white-witch',
                Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              ),
              Track.of(
                'Frayle - Wandering Star',
                'https://frayle.bandcamp.com/track/wandering-star-4',
                Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              ),
              Track.of(
                'Frayle - Things That Make Us Bleed',
                'https://frayle.bandcamp.com/track/things-that-make-us-bleed',
                Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              ),
            ]),
          ),
        )
      }),
    MsDuration.unwrap(MsDuration.seconds(30)),
  )

  it('should validate Bandcamp track', () =>
    validateTracks('https://frayle.bandcamp.com/track/the-white-witch')().then(res => {
      expect(res).toStrictEqual(
        Either.right(
          Either.right(
            NonEmptyArray.of(
              Track.of(
                'Frayle - The White Witch',
                'https://frayle.bandcamp.com/track/the-white-witch',
                Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              ),
            ),
          ),
        ),
      )
    }))
})
