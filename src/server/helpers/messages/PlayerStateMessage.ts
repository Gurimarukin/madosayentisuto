import type { APIButtonComponentWithCustomId, BaseMessageOptions } from 'discord.js'
import { io, random } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import type { PlaylistType } from '../../../shared/models/audio/PlaylistType'
import type { Track } from '../../../shared/models/audio/music/Track'
import { StringUtils } from '../../../shared/utils/StringUtils'
import type { Dict } from '../../../shared/utils/fp'
import { List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { constants } from '../../config/constants'
import type { MyFile } from '../../models/FileOrDir'
import { MessageComponent } from '../../models/discord/MessageComponent'

const { cdnBase } = constants

type IsPaused = {
  isPaused: boolean
}

const queueDisplay = 5

const images = {
  empty: `${cdnBase}/player-empty.png`,
  jpDjGifs: [`${cdnBase}/player-dj1.gif`, `${cdnBase}/player-dj2.gif`] as const,
  jpPerdu: `${cdnBase}/jp-perdu.png`,
  playlist: {
    elevator: [`${cdnBase}/player-elevator1.png`, `${cdnBase}/player-elevator2.png`],
    heimerLoco: [`${cdnBase}/heimer1.webp`],
  } satisfies Dict<PlaylistType, NonEmptyArray<string>>,
}

const ButtonIds = {
  playPause: 'playerPlayPause',
  next: 'playerNext',
  stop: 'playerStop',
}

const pauseButton = MessageComponent.buttonWithCustomId({
  custom_id: ButtonIds.playPause,
  label: 'Pause',
  emoji: constants.emojis.pause,
})

const playButton = MessageComponent.buttonWithCustomId({
  custom_id: ButtonIds.playPause,
  label: 'Lecture',
  emoji: constants.emojis.play,
})

const playPauseButton = ({ isPaused }: IsPaused): APIButtonComponentWithCustomId =>
  isPaused ? playButton : pauseButton

const nextButton = MessageComponent.buttonWithCustomId({
  custom_id: ButtonIds.next,
  label: 'Suivant',
  emoji: constants.emojis.next,
})

const stopButton = MessageComponent.buttonWithCustomId({
  custom_id: ButtonIds.stop,
  label: 'Stop',
  emoji: constants.emojis.stop,
})

const getConnecting = (images_: NonEmptyArray<string>): io.IO<BaseMessageOptions> =>
  pipe(
    random.randomElem(images_),
    io.map(
      (image): BaseMessageOptions => ({
        embeds: [
          MessageComponent.safeEmbed({
            color: constants.messagesColor,
            author: MessageComponent.author('Chargement...'),
            thumbnail: MessageComponent.thumbnail(images.jpPerdu),
            image: MessageComponent.image(image),
          }),
        ],
        components: [
          MessageComponent.row([
            { ...playPauseButton({ isPaused: false }), disabled: true },
            { ...nextButton, disabled: true },
            { ...stopButton, disabled: true },
          ]),
        ],
      }),
    ),
  )

const connecting = {
  Music: getConnecting(images.jpDjGifs),
  Playlist: (playlist: PlaylistType) => getConnecting(images.playlist[playlist]),
}

const playing = {
  music: (
    current: Maybe<Track>,
    queue: List<Track>,
    { isPaused }: IsPaused,
  ): io.IO<BaseMessageOptions> =>
    pipe(
      random.randomElem(images.jpDjGifs),
      io.map(
        (image): BaseMessageOptions => ({
          embeds: [
            MessageComponent.safeEmbed({
              color: constants.messagesColor,
              author: MessageComponent.author('En cours de lecture :'),
              title: pipe(
                current,
                Maybe.map(t => t.title),
                Maybe.toUndefined,
              ),
              url: pipe(
                current,
                Maybe.map(t => t.url),
                Maybe.toUndefined,
              ),
              description: pipe(
                current,
                Maybe.fold(
                  () => '*Aucun morceau en cours*',
                  () => undefined,
                ),
              ),
              thumbnail: pipe(
                current,
                Maybe.chain(t => t.thumbnail),
                Maybe.getOrElse(() => images.jpPerdu),
                MessageComponent.thumbnail,
              ),
              fields: [
                MessageComponent.field(
                  constants.emptyChar,
                  pipe(
                    queue,
                    List.match(
                      () =>
                        StringUtils.stripMargins(
                          `*Aucun morceau dans la file d'attente.*
                        |
                        |\`/${Keys.play} <${Keys.track}>\` pour en ajouter`,
                        ),
                      flow(
                        List.takeLeft(queueDisplay),
                        List.map(t => `${maskedLink(constants.emojis.link, t.url)} ${t.title}`),
                        List.mkString(
                          `*File d'attente (${queue.length}) :*\n`,
                          '\n',
                          queue.length <= queueDisplay ? '' : '\n...',
                        ),
                      ),
                    ),
                  ),
                ),
              ],
              image: MessageComponent.image(image),
            }),
          ],
          components: [
            MessageComponent.row([playPauseButton({ isPaused }), nextButton, stopButton]),
          ],
        }),
      ),
    ),

  playlist: (
    type: PlaylistType,
    playlist: NonEmptyArray<MyFile>,
    { isPaused }: IsPaused,
  ): io.IO<BaseMessageOptions> =>
    pipe(
      random.randomElem(images.playlist[type]),
      io.map(
        (image): BaseMessageOptions => ({
          embeds: [
            MessageComponent.safeEmbed({
              color: constants.messagesColor,
              author: MessageComponent.author('En cours de lecture :'),
              title: `\`${NonEmptyArray.head(playlist).basename}\``,
              thumbnail: MessageComponent.thumbnail(images.jpPerdu),
              fields: [
                MessageComponent.field(
                  constants.emptyChar,
                  pipe(
                    NonEmptyArray.tail(playlist),
                    List.map(f => `· \`${f.basename}\``),
                    List.mkString('\n'),
                  ),
                ),
              ],
              image: MessageComponent.image(image),
            }),
          ],
          components: [
            MessageComponent.row([playPauseButton({ isPaused }), nextButton, stopButton]),
          ],
        }),
      ),
    ),
}

const Keys = {
  play: ['jouer', 'musique', 'play'] as const,
  track: 'morceau',
}

export const PlayerStateMessage = { ButtonIds, connecting, playing, Keys }

const maskedLink = (text: string, url: string): string => `[${text}](${url})`
