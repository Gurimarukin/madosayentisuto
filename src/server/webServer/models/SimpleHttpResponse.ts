import { pipe } from 'fp-ts/function'
import type { Status } from 'hyper-ts'

import type { NonEmptyArray } from '../../../shared/utils/fp'
import { Dict, List } from '../../../shared/utils/fp'

type SimpleHttpResponse = {
  status: Status
  body: string
  headers: Dict<string, NonEmptyArray<string>>
}

const of = (
  status: Status,
  body: string,
  headers: Dict<string, NonEmptyArray<string>> = {},
): SimpleHttpResponse => ({ status, body, headers })

const toRawHttp = ({ status, body, headers }: SimpleHttpResponse): string =>
  pipe(
    [
      `HTTP/1.1 ${status}`,
      ...pipe(
        headers,
        Dict.toReadonlyArray,
        List.map(([key, val]) => `${key}: ${pipe(val, List.mkString('; '))}`),
      ),
      '',
      body,
    ],
    List.mkString('', '\r\n', '\r\n'),
  )

const SimpleHttpResponse = { of, toRawHttp }

export { SimpleHttpResponse }
