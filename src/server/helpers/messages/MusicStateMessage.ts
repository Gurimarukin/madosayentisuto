import type { BaseMessageOptions } from 'discord.js'
import { random } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { StringUtils } from '../../../shared/utils/StringUtils'
import { IO } from '../../../shared/utils/fp'
import { List, Maybe } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import { MessageComponent } from '../../models/discord/MessageComponent'
import type { Track } from '../../models/music/Track'

export const musicStateButtons = {
  playPauseId: 'musicPlayPause',
  nextId: 'musicNext',
}

const queueDisplay = 5
const images = {
  empty: 'https://cdn.discordapp.com/attachments/849299103362973777/914578024366747668/vide.png',
  jpDjGifs: ['https://i.imgur.com/xwfsgKH.gif', 'https://i.imgur.com/QVhHr0g.gif'] as const,
  jpPerdu:
    'https://cdn.discordapp.com/attachments/849299103362973777/914484866098282506/jp_perdu.png',
}

const pauseButton = MessageComponent.buttonWithCustomId({
  custom_id: musicStateButtons.playPauseId,
  label: 'Pause',
  emoji: constants.emojis.pause,
})
const playButton = MessageComponent.buttonWithCustomId({
  custom_id: musicStateButtons.playPauseId,
  label: 'Lecture',
  emoji: constants.emojis.play,
})
const nextButton = MessageComponent.buttonWithCustomId({
  custom_id: musicStateButtons.nextId,
  label: 'Suivant',
  emoji: constants.emojis.next,
})

const connecting: IO<BaseMessageOptions> = pipe(
  random.randomElem(images.jpDjGifs),
  IO.fromIO,
  IO.map(
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
          { ...playButton, disabled: true },
          { ...nextButton, disabled: true },
        ]),
      ],
    }),
  ),
)

const playing = (
  current: Maybe<Track>,
  queue: List<Track>,
  isPlaying: boolean,
): IO<BaseMessageOptions> =>
  pipe(
    random.randomElem(images.jpDjGifs),
    IO.fromIO,
    IO.map(
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
        components: [MessageComponent.row([isPlaying ? pauseButton : playButton, nextButton])],
      }),
    ),
  )

const Keys = {
  play: 'jouer',
  track: 'morceau',
}

export const MusicStateMessage = { connecting, playing, Keys }

const maskedLink = (text: string, url: string): string => `[${text}](${url})`
