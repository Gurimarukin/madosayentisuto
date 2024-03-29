import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import readline from 'readline'

import { MsDuration } from '../../shared/models/MsDuration'
import { ClearPassword } from '../../shared/models/webUser/ClearPassword'
import type { Token } from '../../shared/models/webUser/Token'
import { UserName } from '../../shared/models/webUser/UserName'
import type { Maybe, NotUsed } from '../../shared/utils/fp'
import { Future, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { JwtHelper } from '../helpers/JwtHelper'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { TokenContent } from '../models/webUser/TokenContent'
import { WebUser } from '../models/webUser/WebUser'
import { WebUserId } from '../models/webUser/WebUserId'
import type { UserPersistence } from '../persistence/UserPersistence'
import { PasswordUtils } from '../utils/PasswordUtils'

const accountTokenTtl = MsDuration.days(30)

export type UserService = ReturnType<typeof UserService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function UserService(
  Logger: LoggerGetter,
  userPersistence: UserPersistence,
  jwtHelper: JwtHelper,
) {
  const logger = Logger('UserService')

  const createUser: Future<NotUsed> = pipe(
    Future.fromIOEither(logger.info('Creating user')),
    Future.chain(() =>
      apply.sequenceT(Future.ApplySeq)(
        prompt('userName: '),
        prompt('password: '),
        prompt('confirm password: '),
      ),
    ),
    Future.chain(([userName, password, confirm]) =>
      password !== confirm
        ? Future.failed(Error('Passwords must be the same'))
        : pipe(
            apply.sequenceS(Future.ApplyPar)({
              id: Future.fromIOEither(WebUserId.generate),
              hashed: PasswordUtils.hash(ClearPassword.wrap(password)),
            }),
            Future.chain(({ id, hashed }) =>
              userPersistence.create(WebUser.of(id, UserName.wrap(userName), hashed)),
            ),
            Future.filterOrElse(
              success => success,
              () => Error('Failed to create user'),
            ),
            Future.map(toNotUsed),
          ),
    ),
  )

  const signToken = (content: TokenContent): Future<Token> =>
    jwtHelper.sign(TokenContent.codec)(content, { expiresIn: accountTokenTtl })

  const verifyToken = (token: string): Future<TokenContent> =>
    jwtHelper.verify([TokenContent.codec, 'TokenContent'])(token)

  return {
    verifyToken,

    login: (userName: UserName, clearPassword: ClearPassword): Future<Maybe<Token>> =>
      pipe(
        futureMaybe.Do,
        futureMaybe.apS('user', userPersistence.findByUserName(userName)),
        futureMaybe.bind('validPassword', ({ user }) =>
          futureMaybe.fromTaskEither(PasswordUtils.check(user.password, clearPassword)),
        ),
        futureMaybe.filter(({ validPassword }) => validPassword),
        futureMaybe.chainTaskEitherK(({ user }) => signToken({ id: user.id })),
      ),

    createUser,
  }
}

const prompt = (label: string): Future<string> =>
  pipe(
    Future.tryCatch(() => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      return new Promise<string>(resolve => rl.question(label, answer => resolve(answer))).then(
        res => {
          // eslint-disable-next-line functional/no-expression-statements
          rl.close()
          return res
        },
      )
    }),
  )
