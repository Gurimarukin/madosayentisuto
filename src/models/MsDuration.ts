import { Newtype, iso } from 'newtype-ts'

export type MsDuration = Newtype<{ readonly MsDuration: unique symbol }, number>

const isoMsDuration = iso<MsDuration>()

export namespace MsDuration {
  export const wrap = isoMsDuration.wrap
  export const unwrap = isoMsDuration.unwrap

  export const seconds = (n: number): MsDuration => wrap(1000 * n)
  export const minutes = (n: number): MsDuration => seconds(60 * n)
  export const hours = (n: number): MsDuration => minutes(60 * n)
  export const days = (n: number): MsDuration => hours(24 * n)
}
