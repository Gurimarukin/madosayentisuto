import type {
  ColorResolvable,
  MessageButtonStyleResolvable,
  MessageOptions,
  MessagePayload,
} from 'discord.js'
import { MessageActionRow, MessageButton } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { List, Maybe } from '../../shared/utils/fp'

import { Colors, constants } from '../constants'
import type { Track } from '../models/music/Track'
import { MessageUtils } from '../utils/MessageUtils'
import { StringUtils } from '../utils/StringUtils'

type MyMessageOptions = string | MessagePayload | MessageOptions

export const musicButtons = {
  playPauseId: 'musicPlayPause',
  nextId: 'musicNext',
}

const queueDisplay = 5
const messagesColor: ColorResolvable = Colors.darkred
const images = {
  empty: 'https://cdn.discordapp.com/attachments/849299103362973777/914578024366747668/vide.png',
  jpDjGif: 'https://i.imgur.com/lBrj5I6.gif',
  jpPerdu:
    'https://cdn.discordapp.com/attachments/849299103362973777/914484866098282506/jp_perdu.png',
}

const connecting = MessageUtils.singleSafeEmbed({
  color: messagesColor,
  description: 'Chargement...',
})

const playing_ = (
  playing: Maybe<Track>,
  queue: List<Track>,
  isPlaying: boolean,
): MyMessageOptions => ({
  embeds: [
    MessageUtils.safeEmbed({
      color: messagesColor,
      author: MessageUtils.author('En cours de lecture :'),
      title: pipe(
        playing,
        Maybe.map(t => t.title),
        Maybe.toUndefined,
      ),
      url: pipe(
        playing,
        Maybe.map(t => t.url),
        Maybe.toUndefined,
      ),
      description: pipe(
        playing,
        Maybe.fold(
          () => '*Aucun morceau en cours*',
          () => undefined,
        ),
      ),
      thumbnail: pipe(
        playing,
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
              () => `*Aucun morceau dans la file d'attente.*\n\`/play <url>\` *pour en ajouter*`,
              flow(
                List.takeLeft(queueDisplay),
                List.map(t => `${maskedLink(constants.emojis.link, t.url)} ${t.title}`),
                StringUtils.mkString(
                  `*File d'attente (${queue.length}) :*\n`,
                  '\n',
                  queue.length <= queueDisplay ? '' : '\n...',
                ),
              ),
            ),
          ),
        ),
      ],
      image: MessageUtils.image(images.jpDjGif),
    }),
  ],
  components: [
    new MessageActionRow().addComponents(isPlaying ? pauseButton : playButton, nextButton),
  ],
})

const button = (
  id: string,
  label: string,
  emoji: string,
  style: MessageButtonStyleResolvable = 'SECONDARY',
): MessageButton =>
  new MessageButton().setCustomId(id).setLabel(label).setStyle(style).setEmoji(emoji)

const pauseButton = button(musicButtons.playPauseId, 'Pause', constants.emojis.pause)
const playButton = button(musicButtons.playPauseId, 'Lecture', constants.emojis.play)
const nextButton = button(musicButtons.nextId, 'Suivant', constants.emojis.next)

const maskedLink = (text: string, url: string): string => `[${text}](${url})`

export const getMusicStateMessage = { connecting, playing: playing_ }
