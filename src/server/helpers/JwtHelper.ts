import { pipe } from 'fp-ts/function'
import type { Decoder } from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'
import jwt from 'jsonwebtoken'

import { MsDuration } from '../../shared/models/MsDuration'
import { Token } from '../../shared/models/webUser/Token'
import type { Tuple } from '../../shared/utils/fp'
import { Dict, Either, Future, List, Maybe } from '../../shared/utils/fp'
import { decodeError } from '../../shared/utils/ioTsUtils'

type MySignOptions = Omit<jwt.SignOptions, 'expiresIn' | 'notBefore'> & {
  readonly expiresIn?: MsDuration
  readonly notBefore?: MsDuration
}

type MyVerifyOptions = Omit<jwt.VerifyOptions, 'complete'>

export type JwtHelper = ReturnType<typeof JwtHelper>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const JwtHelper = (secret: string) => ({
  sign:
    <O extends Dict<string, unknown>, A>(encoder: Encoder<O, A>) =>
    (a: A, { expiresIn, notBefore, ...options }: MySignOptions = {}): Future<Token> =>
      pipe(
        Future.tryCatch(
          () =>
            new Promise<Maybe<string>>((resolve, reject) =>
              jwt.sign(
                encoder.encode(a),
                secret,
                {
                  ...options,
                  ...msDurationOptions({ expiresIn, notBefore }),
                },
                (err, encoded) =>
                  err !== null ? reject(err) : resolve(Maybe.fromNullable(encoded)),
              ),
            ),
        ),
        Future.chain(Future.fromOption(() => Error('undefined jwt (this should never happen)'))),
        Future.map(Token.wrap),
      ),

  verify:
    <A>([decoder, decoderName]: Tuple<Decoder<string | jwt.JwtPayload, A>, string>) =>
    (token: string, options: MyVerifyOptions = {}) =>
      pipe(
        Future.tryCatch(
          () =>
            new Promise<Maybe<string | jwt.JwtPayload>>((resolve, reject) =>
              jwt.verify(token, secret, { ...options, complete: false }, (err, decoded) =>
                err !== null ? reject(err) : resolve(Maybe.fromNullable(decoded)),
              ),
            ),
        ),
        Future.chain(
          Future.fromOption(() => Error('undefined payload (this should never happen)')),
        ),
        Future.chainEitherK(u =>
          pipe(decoder.decode(u), Either.mapLeft(decodeError(decoderName)(u))),
        ),
      ),
})

const msDurationOptions = <K extends string>(
  obj: Dict<K, MsDuration | undefined>,
): Partial<Dict<K, string>> =>
  pipe(
    obj,
    Dict.toReadonlyArray,
    List.reduce({}, (acc, [key, val]) =>
      val === undefined ? acc : { ...acc, [key]: `${MsDuration.unwrap(val)}` },
    ),
  )
