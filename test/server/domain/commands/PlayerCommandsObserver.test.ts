import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { describe, it } from 'vitest'

import { DayJs } from '../../../../src/shared/models/DayJs'
import type { LoggerType } from '../../../../src/shared/models/LoggerType'
import { MsDuration } from '../../../../src/shared/models/MsDuration'
import type { Track } from '../../../../src/shared/models/audio/music/Track'
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
import { PlayerCommandsObserver } from '../../../../src/server/domain/commands/PlayerCommandsObserver'
import { YtDlp } from '../../../../src/server/helpers/YtDlp'
import { MyFile } from '../../../../src/server/models/FileOrDir'
import { consoleLogFormat } from '../../../../src/server/models/logger/observers/ConsoleLogObserver'
import type { GuildStateService } from '../../../../src/server/services/GuildStateService'
import { utilFormat } from '../../../../src/server/utils/utilInspect'

import { expectT } from '../../../expectT'

describe('validateTracks', () => {
  const { ytDlpPath } = pipe(Config.load, IO.runUnsafe)

  const { validateTracks } = PlayerCommandsObserver(
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
    { playlistFiles: () => io.of(NonEmptyArray.of(MyFile.fromPath(''))) },
    YtDlp(ytDlpPath),
    {} as GuildStateService,
  )

  const whenImTwi: Track = {
    extractor: 'youtube',
    title: "When i'm TWI !",
    url: 'https://www.youtube.com/watch?v=aeWfN6CinGY',
    thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/aeWfN6CinGY/maxresdefault.webp'),
  }

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
            {
              extractor: 'youtube:tab',
              title: "YOU WON'T BELIEVE WHAT THIS SCREAMING MAN CAN DO !!",
              url: 'https://www.youtube.com/watch?v=psCSnnioq0M',
              thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/psCSnnioq0M/maxresdefault.webp'),
            },
            {
              extractor: 'youtube:tab',
              title: 'My work here is done',
              url: 'https://www.youtube.com/watch?v=0AfNhK9aCjo',
              thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/0AfNhK9aCjo/maxresdefault.webp'),
            },
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
              NonEmptyArray.of({
                extractor: 'youtube:search',
                title: 'SARDOCHE LE NERVEUX',
                url: 'https://www.youtube.com/watch?v=IvKbpO0cMKM',
                thumbnail: Maybe.some('https://i.ytimg.com/vi_webp/IvKbpO0cMKM/maxresdefault.webp'),
              }),
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
        expectT(res).toStrictEqual(Either.right(Either.left('Erreur'))) // URL invalide.
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
              {
                extractor: 'Bandcamp:album',
                title: 'Frayle - Let The Darkness In',
                url: 'https://frayle.bandcamp.com/track/let-the-darkness-in-2',
                thumbnail: Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              },
              {
                extractor: 'Bandcamp:album',
                title: 'Frayle - The White Witch',
                url: 'https://frayle.bandcamp.com/track/the-white-witch',
                thumbnail: Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              },
              {
                extractor: 'Bandcamp:album',
                title: 'Frayle - Wandering Star',
                url: 'https://frayle.bandcamp.com/track/wandering-star-4',
                thumbnail: Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              },
              {
                extractor: 'Bandcamp:album',
                title: 'Frayle - Things That Make Us Bleed',
                url: 'https://frayle.bandcamp.com/track/things-that-make-us-bleed',
                thumbnail: Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
              },
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
            NonEmptyArray.of({
              extractor: 'Bandcamp',
              title: 'Frayle - The White Witch',
              url: 'https://frayle.bandcamp.com/track/the-white-witch',
              thumbnail: Maybe.some('https://f4.bcbits.com/img/a4080863901_5.jpg'),
            }),
          ),
        ),
      )
    }))
})
