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

import { StringUtils } from './StringUtils'

type UrlHeightWidthProxy = {
  readonly url?: string
  readonly height?: number
  readonly width?: number
  readonly proxyURL?: string
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

type MessageEmbedArgs = {
  readonly title?: string
  readonly description?: string
  readonly url?: string
  readonly color?: ColorResolvable
  readonly fields?: List<EmbedFieldData>
  readonly author?: Partial<MessageEmbedAuthor> & {
    readonly icon_url?: string
    readonly proxy_icon_url?: string
  }
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

const field = (name = '\u200B', value = '\u200B', inline?: boolean): EmbedFieldData => ({
  name,
  value,
  inline,
})

const urlHeightWidthProxy =
  <A extends UrlHeightWidthProxy>() =>
  (url: string, height?: number, width?: number, proxyURL?: string): A =>
    ({
      url,
      height,
      width,
      proxyURL,
    } as A)

const thumbnail = urlHeightWidthProxy<MyThumbnail>()
const image = urlHeightWidthProxy<MyImage>()
const video = urlHeightWidthProxy<MyVideo>()

const singleSafeEmbed = (args: MessageEmbedArgs): MessageOptions => ({ embeds: [safeEmbed(args)] })

export const MessageUtils = { safeEmbed, field, thumbnail, image, video, singleSafeEmbed }
