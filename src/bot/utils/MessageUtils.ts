import type {
  ColorResolvable,
  EmbedFieldData,
  MessageEmbedAuthor,
  MessageEmbedFooter,
  MessageEmbedImage,
  MessageEmbedOptions,
  MessageEmbedThumbnail,
  MessageEmbedVideo,
  MessageOptions,
} from 'discord.js'
import { pipe } from 'fp-ts/function'

import type { List } from '../../shared/utils/fp'

import { constants } from '../constants'
import { StringUtils } from './StringUtils'

type UrlHeightWidthProxy = {
  readonly url?: string
  readonly height?: number
  readonly width?: number
  readonly proxyURL?: string
}

type MyAuthor = Partial<MessageEmbedAuthor> & {
  readonly _tag: 'Author'
  readonly icon_url?: string
  readonly proxy_icon_url?: string
}
type MyThumbnail = Partial<MessageEmbedThumbnail> & {
  readonly _tag: 'Thumbnail'
  readonly proxy_url?: string
}
type MyImage = Partial<MessageEmbedImage> & {
  readonly _tag: 'Image'
  readonly proxy_url?: string
}
type MyVideo = Partial<MessageEmbedVideo> & {
  readonly _tag: 'Video'
  readonly proxy_url?: string
}
type MyFooter = Partial<MessageEmbedFooter> & {
  readonly _tag: 'Footer'
  readonly icon_url?: string
  readonly proxy_icon_url?: string
}

type MessageEmbedArgs = {
  readonly title?: string
  readonly description?: string
  readonly url?: string
  readonly color?: ColorResolvable
  readonly fields?: List<EmbedFieldData>
  readonly author?: MyAuthor
  readonly thumbnail?: MyThumbnail
  readonly image?: MyImage
  readonly video?: MyVideo
  readonly timestamp?: Date
  readonly footer?: Partial<MessageEmbedFooter> & {
    readonly icon_url?: string
    readonly proxy_icon_url?: string
  }
}

const safeEmbed = ({ title, fields, ...args }: MessageEmbedArgs): MessageEmbedOptions => ({
  ...args,
  title: title === undefined ? undefined : pipe(title, StringUtils.ellipse(256)),
  // eslint-disable-next-line functional/prefer-readonly-type
  fields: fields as EmbedFieldData[] | undefined,
})

const field = (
  name = constants.emptyChar,
  value = constants.emptyChar,
  inline?: boolean,
): EmbedFieldData => ({ name, value, inline })

const urlHeightWidthProxy =
  <A extends UrlHeightWidthProxy>() =>
  (url: string, height?: number, width?: number, proxyURL?: string): A =>
    ({
      url,
      height,
      width,
      proxyURL,
    } as A)

const author = (
  name: string,
  url?: string,
  iconURL?: string,
  proxyIconURL?: string,
  icon_url?: string,
  proxy_icon_url?: string,
): MyAuthor => ({ name, url, iconURL, proxyIconURL, icon_url, proxy_icon_url } as MyAuthor)

const thumbnail = urlHeightWidthProxy<MyThumbnail>()
const image = urlHeightWidthProxy<MyImage>()
const video = urlHeightWidthProxy<MyVideo>()

const footer = (
  text: string,
  iconURL?: string,
  proxyIconURL?: string,
  icon_url?: string,
  proxy_icon_url?: string,
): MyFooter => ({ text, iconURL, proxyIconURL, icon_url, proxy_icon_url } as MyFooter)

const singleSafeEmbed = (args: MessageEmbedArgs): MessageOptions => ({ embeds: [safeEmbed(args)] })

export const MessageUtils = {
  safeEmbed,
  field,
  author,
  thumbnail,
  image,
  video,
  footer,
  singleSafeEmbed,
}
