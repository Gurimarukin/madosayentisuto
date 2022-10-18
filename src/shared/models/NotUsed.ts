import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

type NotUsed = Newtype<{ readonly NotUsed: unique symbol }, void>

const NotUsed = iso<NotUsed>().wrap(undefined)

export { NotUsed }
