import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { StringUtils } from './StringUtils'

const limit = 10000

export const decodeError =
  (name: string) =>
  (value: unknown) =>
  (error: D.DecodeError): Error =>
    Error(
      StringUtils.stripMargins(
        `Couldn't decode ${name}:
        |Error:
        |${pipe(D.draw(error), StringUtils.ellipse(limit))}
        |
        |Value: ${pipe(JSON.stringify(value), StringUtils.ellipse(limit))}`,
      ),
    )
