import { pipe } from 'fp-ts/function'

import { MsDuration } from '../../../src/shared/models/MsDuration'
import { Either, Future, Maybe, NonEmptyArray } from '../../../src/shared/utils/fp'

import { MusicCommandsObserver } from '../../../src/bot/domain/commands/MusicCommandsObserver'
import { YoutubeDl } from '../../../src/bot/helpers/YoutubeDl'
import type { LoggerType } from '../../../src/bot/models/logger/LoggerType'
import { Track } from '../../../src/bot/models/music/Track'
import type { GuildStateService } from '../../../src/bot/services/GuildStateService'
import { StringUtils } from '../../../src/bot/utils/StringUtils'

describe('validateTrack', () => {
  const { validateTrack } = MusicCommandsObserver(
    () => ({} as LoggerType),
    YoutubeDl('/usr/local/bin/youtube-dl'),
    {} as GuildStateService,
  )

  const whenImTwi: Track = Track.of(
    "When i'm TWI !",
    'https://www.youtube.com/watch?v=aeWfN6CinGY',
    Maybe.some('https://i.ytimg.com/vi_webp/aeWfN6CinGY/maxresdefault.webp'),
  )

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
        expect(res).toStrictEqual(
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
        )
      }),
      Future.runUnsafe,
    ))

  it('should search', () =>
    pipe(
      validateTrack('adedigado'),
      Future.map(res => {
        expect(res).toStrictEqual(
          Either.right(
            NonEmptyArray.of(
              Track.of(
                'SARDOCHE LE NERVEUX',
                'https://www.youtube.com/watch?v=IvKbpO0cMKM',
                Maybe.some('https://i.ytimg.com/vi_webp/IvKbpO0cMKM/maxresdefault.webp'),
              ),
            ),
          ),
        )
      }),
      Future.runUnsafe,
    ))

  it('should fail on invalid site', () =>
    validateTrack('https://dl.blbl.ch')().then(res => {
      expect(res).toStrictEqual(
        Either.left(
          Error(
            StringUtils.stripMargins(
              `Command failed with exit code 1: /usr/local/bin/youtube-dl https://dl.blbl.ch --dump-single-json --default-search ytsearch
              |WARNING: Could not send HEAD request to https://dl.blbl.ch: HTTP Error 403: Forbidden
              |ERROR: Unable to download webpage: HTTP Error 403: Forbidden (caused by <HTTPError 403: 'Forbidden'>); please report this issue on https://yt-dl.org/bug . Make sure you are using the latest version; see  https://yt-dl.org/update  on how to update. Be sure to call youtube-dl with the --verbose flag and include its complete output.`,
            ),
          ),
        ),
      )
    }))

  it(
    'should validate Bandcamp album',
    () =>
      pipe(
        validateTrack('https://frayle.bandcamp.com/album/the-white-witch-ep'),
        Future.map(res => {
          expect(res).toStrictEqual(
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
          )
        }),
        Future.runUnsafe,
      ),
    MsDuration.unwrap(MsDuration.seconds(30)),
  )

  it('should validate Bandcamp track', () =>
    pipe(
      validateTrack('https://frayle.bandcamp.com/track/the-white-witch'),
      Future.map(res => {
        expect(res).toStrictEqual(
          Either.right(
            NonEmptyArray.of(
              Track.of(
                'Frayle - The White Witch',
                'https://frayle.bandcamp.com/track/the-white-witch',
                Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              ),
            ),
          ),
        )
      }),
      Future.runUnsafe,
    ))
})
