import type {
  BaseMessageComponentOptions,
  InteractionButtonOptions,
  MessageButtonOptions,
} from 'discord.js'
import { MessageActionRow } from 'discord.js'
import { random } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { StringUtils } from '../../../shared/utils/StringUtils'
import { IO } from '../../../shared/utils/fp'
import { List, Maybe } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import type { Track } from '../../models/music/Track'
import { MessageUtils } from '../../utils/MessageUtils'
import type { MyMessageOptions } from '../DiscordConnector'

type MyButton = Required<BaseMessageComponentOptions> & MessageButtonOptions

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

const button = (
  customId: string,
  label: string,
  emoji: string,
  style: InteractionButtonOptions['style'] = 'SECONDARY',
): MyButton => ({ type: 'BUTTON', customId, label, emoji, style })

const pauseButton = button(musicStateButtons.playPauseId, 'Pause', constants.emojis.pause)
const playButton = button(musicStateButtons.playPauseId, 'Lecture', constants.emojis.play)
const nextButton = button(musicStateButtons.nextId, 'Suivant', constants.emojis.next)

const connecting: IO<MyMessageOptions> = pipe(
  random.randomElem(images.jpDjGifs),
  IO.fromIO,
  IO.map(
    (image): MyMessageOptions => ({
      embeds: [
        MessageUtils.safeEmbed({
          color: constants.messagesColor,
          author: MessageUtils.author('Chargement...'),
          thumbnail: MessageUtils.thumbnail(images.jpPerdu),
          image: MessageUtils.image(image),
        }),
      ],
      components: [
        new MessageActionRow().addComponents(
          { ...playButton, disabled: true },
          { ...nextButton, disabled: true },
        ),
      ],
    }),
  ),
)

const playing = (
  current: Maybe<Track>,
  queue: List<Track>,
  isPlaying: boolean,
): IO<MyMessageOptions> =>
  pipe(
    random.randomElem(images.jpDjGifs),
    IO.fromIO,
    IO.map(
      (image): MyMessageOptions => ({
        embeds: [
          MessageUtils.safeEmbed({
            color: constants.messagesColor,
            author: MessageUtils.author('En cours de lecture :'),
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
              MessageUtils.thumbnail,
            ),
            fields: [
              MessageUtils.field(
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
            image: MessageUtils.image(image),
          }),
        ],
        components: [
          new MessageActionRow().addComponents(isPlaying ? pauseButton : playButton, nextButton),
        ],
      }),
    ),
  )

const Keys = {
  play: 'jouer',
  track: 'morceau',
}

export const MusicStateMessage = { connecting, playing, Keys }

const maskedLink = (text: string, url: string): string => `[${text}](${url})`
