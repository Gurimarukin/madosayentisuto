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
import { flow, pipe } from 'fp-ts/function'

import { StringUtils } from '../../shared/utils/StringUtils'
import { List } from '../../shared/utils/fp'

import { constants } from '../constants'

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

const safeEmbed = ({
  title,
  description,
  fields,
  footer,
  author,
  ...args
}: MessageEmbedArgs): MessageEmbedOptions => ({
  ...args,
  title: mapUndefined(title, StringUtils.ellipse(256)),
  description: mapUndefined(description, StringUtils.ellipse(4096)),
  fields: mapUndefined(
    fields,
    flow(
      List.takeLeft(25),
      List.map(
        ({ name, value, inline }): EmbedFieldData => ({
          name: pipe(name, StringUtils.ellipse(256)),
          value: pipe(value, StringUtils.ellipse(1024)),
          inline,
        }),
      ),
    ),
    // eslint-disable-next-line functional/prefer-readonly-type
  ) as EmbedFieldData[] | undefined,
  footer: mapUndefined(footer, ({ text, ...rest }): MessageEmbedOptions['footer'] => ({
    ...rest,
    text: mapUndefined(text, StringUtils.ellipse(2048)),
  })),
  author: mapUndefined(author, ({ name, ...rest }): MessageEmbedOptions['author'] => ({
    ...rest,
    name: mapUndefined(name, StringUtils.ellipse(256)),
  })),
})

const mapUndefined = <A, B>(a: A | undefined, f: (a_: A) => B): B | undefined =>
  a === undefined ? undefined : f(a)

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
