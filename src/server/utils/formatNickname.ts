import { pipe } from 'fp-ts/function'

import { Maybe } from '../../shared/utils/fp'

export const formatNickname = (nickname: string | null | Maybe<string>): string =>
  nickname === null || typeof nickname === 'string'
    ? formatNicknameNullable(nickname)
    : pipe(nickname, Maybe.toNullable, formatNicknameNullable)

const formatNicknameNullable: (nickname: string | null) => string = JSON.stringify
