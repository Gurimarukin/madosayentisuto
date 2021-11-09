import type { Newtype} from 'newtype-ts';
import { iso } from 'newtype-ts'

export type MsDuration = Newtype<{ readonly MsDuration: unique symbol }, number>

const { wrap, unwrap } = iso<MsDuration>()

const seconds = (n: number): MsDuration => wrap(1000 * n)
const minutes = (n: number): MsDuration => seconds(60 * n)
const hours = (n: number): MsDuration => minutes(60 * n)
const days = (n: number): MsDuration => hours(24 * n)

export const MsDuration = { seconds, minutes, hours, days, unwrap }
