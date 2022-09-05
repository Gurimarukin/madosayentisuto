import type {
  APIEmbed,
  APIEmbedThumbnail,
  APIEmbedVideo,
  ColorResolvable,
  EmbedAuthorData,
  EmbedField,
  EmbedFooterData,
  EmbedImageData,
  MessageOptions,
} from 'discord.js'
import { EmbedBuilder } from 'discord.js'
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

// _tag don't exist at runtime (see cast below)

type MyAuthor = EmbedAuthorData & {
  readonly _tag: 'Author'
}
type MyThumbnail = APIEmbedThumbnail & {
  readonly _tag: 'Thumbnail'
}
type MyImage = EmbedImageData & {
  readonly _tag: 'Image'
}
type MyVideo = APIEmbedVideo & {
  readonly _tag: 'Video'
}
type MyFooter = EmbedFooterData & {
  readonly _tag: 'Footer'
}

type MessageEmbedArgs = {
  readonly title?: string
  readonly description?: string
  readonly url?: string
  readonly color?: ColorResolvable
  readonly fields?: List<EmbedField>
  readonly author?: MyAuthor
  readonly thumbnail?: MyThumbnail
  readonly image?: MyImage
  readonly video?: MyVideo
  readonly timestamp?: Date
  readonly footer?: MyFooter
}

const safeEmbed = ({
  title,
  description,
  color,
  fields,
  footer,
  author,
  timestamp,
  ...args
}: MessageEmbedArgs): APIEmbed => ({
  ...args,
  title: mapUndefined(title, StringUtils.ellipse(256)),
  description: mapUndefined(description, StringUtils.ellipse(4096)),
  color: mapUndefined(color, c => new EmbedBuilder().setColor(c).toJSON().color),
  fields: mapUndefined(
    fields,
    flow(
      List.takeLeft(25),
      List.map(({ name, value, inline }) =>
        field(pipe(name, StringUtils.ellipse(256)), pipe(value, StringUtils.ellipse(1024)), inline),
      ),
      List.toMutable,
    ),
  ),
  footer: mapUndefined(
    footer,
    ({ text, ...rest }): MyFooter => ({
      ...rest,
      text: pipe(text, StringUtils.ellipse(2048)),
    }),
  ),
  author: mapUndefined(
    author,
    ({ name, ...rest }): MyAuthor => ({
      ...rest,
      name: pipe(name, StringUtils.ellipse(256)),
    }),
  ),
  timestamp: mapUndefined(timestamp, d => d.toISOString()),
})

const mapUndefined = <A, B>(fa: A | undefined, f: (a: A) => B): B | undefined =>
  fa === undefined ? undefined : f(fa)

const field = (
  name = constants.emptyChar,
  value = constants.emptyChar,
  inline = true,
): EmbedField => ({ name, value, inline })

const urlHeightWidthProxy =
  <A extends UrlHeightWidthProxy>() =>
  (url: string, height?: number, width?: number, proxyURL?: string): A =>
    ({
      url,
      height,
      width,
      proxyURL,
    } as A)

const author = (name: string, url?: string, iconURL?: string, proxyIconURL?: string): MyAuthor =>
  ({ name, url, iconURL, proxyIconURL } as MyAuthor)

const thumbnail = urlHeightWidthProxy<MyThumbnail>()
const image = urlHeightWidthProxy<MyImage>()
const video = urlHeightWidthProxy<MyVideo>()

const footer = (text: string, iconURL?: string, proxyIconURL?: string): MyFooter =>
  ({ text, iconURL, proxyIconURL } as MyFooter)

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
