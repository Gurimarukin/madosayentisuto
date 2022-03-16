import { pipe } from 'fp-ts/function'

import type { Dict } from '../../shared/utils/fp'
import { Try } from '../../shared/utils/fp'

import { Config } from './Config'

// It's important to have process.env.ENV_VAR fully, as it is inlined by Parcel
const inlined: Dict<string, string | undefined> = {
  API_HOST: process.env.API_HOST,
}

export const config = pipe(inlined, Config.parse, Try.getUnsafe)
