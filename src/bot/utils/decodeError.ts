import { StringUtils } from 'bot/utils/StringUtils'
import * as D from 'io-ts/Decoder'

export const decodeError =
  (name: string) =>
  (value: unknown) =>
  (error: D.DecodeError): Error =>
    Error(
      StringUtils.stripMargins(
        `Couldn't decode ${name}:
        |Error:
        |${D.draw(error)}
        |
        |Value: ${JSON.stringify(value)}`,
      ),
    )
