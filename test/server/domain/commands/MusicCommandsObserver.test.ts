import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../../../src/shared/models/DayJs'
import type { LoggerType } from '../../../../src/shared/models/LoggerType'
import { MsDuration } from '../../../../src/shared/models/MsDuration'
import { Track } from '../../../../src/shared/models/audio/music/Track'
import { LogLevel } from '../../../../src/shared/models/log/LogLevel'
import {
  Dict,
  Either,
  IO,
  List,
  Maybe,
  NonEmptyArray,
  Tuple,
  toNotUsed,
} from '../../../../src/shared/utils/fp'

import { Config } from '../../../../src/server/config/Config'
import { MusicCommandsObserver } from '../../../../src/server/domain/commands/MusicCommandsObserver'
import { YtDlp } from '../../../../src/server/helpers/YtDlp'
import { consoleLogFormat } from '../../../../src/server/models/logger/observers/ConsoleLogObserver'
import type { GuildStateService } from '../../../../src/server/services/GuildStateService'
import { utilFormat } from '../../../../src/server/utils/utilInspect'

import { expectT } from '../../../expectT'

describe('validateTracks', () => {
  const { ytDlpPath } = pipe(Config.load, IO.runUnsafe)

  const { validateTracks } = MusicCommandsObserver(
    name =>
      pipe(
        LogLevel.values,
        List.map(level =>
          Tuple.of<[LogLevel, LoggerType[LogLevel]]>(level, (...u) =>
            pipe(
              DayJs.now,
              IO.fromIO,
              IO.map(flow(consoleLogFormat(name, level, utilFormat(...u)), console.log, toNotUsed)),
            ),
          ),
        ),
        Dict.fromEntries,
      ),
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
      expectT(res).toStrictEqual(Either.right(Either.right(NonEmptyArray.of(whenImTwi))))
    }))

  it('should validate YouTube video (short)', () =>
    validateTracks('https://youtu.be/aeWfN6CinGY')().then(res => {
      expectT(res).toStrictEqual(Either.right(Either.right(NonEmptyArray.of(whenImTwi))))
    }))

  it('should validate YouTube playlist', () =>
    validateTracks(
      'https://www.youtube.com/playlist?list=PLIbD1ba8REOOWyzNL1AEPQMpEflxjcOEL',
    )().then(res => {
      expectT(res).toStrictEqual(
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

  it(
    'should search',
    () =>
      validateTracks('sardoche le nerveux')().then(res => {
        expectT(res).toStrictEqual(
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
      }),
    MsDuration.unwrap(MsDuration.seconds(30)),
  )

  it(
    'should fail on invalid site',
    () =>
      validateTracks('https://blbl.ch')().then(res => {
        expectT(res).toStrictEqual(Either.right(Either.left('URL invalide.')))
      }),
    MsDuration.unwrap(MsDuration.seconds(30)),
  )

  it(
    'should validate Bandcamp album',
    () =>
      validateTracks('https://frayle.bandcamp.com/album/the-white-witch-ep')().then(res => {
        expectT(res).toStrictEqual(
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
      expectT(res).toStrictEqual(
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
