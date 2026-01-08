import bcrypt from 'bcrypt'
import { pipe } from 'fp-ts/function'

import { ClearPassword } from '../../shared/models/webUser/ClearPassword'
import { Future } from '../../shared/utils/fp'

import { HashedPassword } from '../models/webUser/HashedPassword'

const saltRounds = 10

const hash = (clearPassword: ClearPassword): Future<HashedPassword> =>
  pipe(
    Future.tryCatch(() => bcrypt.hash(ClearPassword.unwrap(clearPassword), saltRounds)),
    Future.map(HashedPassword.wrap),
  )

const check = (hashedPassword: HashedPassword, clearPassword: ClearPassword): Future<boolean> =>
  Future.tryCatch(() =>
    bcrypt.compare(HashedPassword.unwrap(hashedPassword), ClearPassword.unwrap(clearPassword)),
  )

export const PasswordUtils = { hash, check }
