import { ord } from 'fp-ts'

import { DayJs } from '../../../src/shared/models/DayJs'

import { expectT } from '../../expectT'

describe('DayJs', () => {
  it('should Ord', () => {
    expectT(ord.lt(DayJs.Ord)(DayJs.of('2020-01-01'), DayJs.of('2020-01-02'))).toStrictEqual(true)
    expectT(ord.lt(DayJs.Ord)(DayJs.of('2020-01-01'), DayJs.of('2020-01-01'))).toStrictEqual(false)
    expectT(ord.lt(DayJs.Ord)(DayJs.of('2020-01-02'), DayJs.of('2020-01-01'))).toStrictEqual(false)

    expectT(ord.gt(DayJs.Ord)(DayJs.of('2020-01-02'), DayJs.of('2020-01-01'))).toStrictEqual(true)
    expectT(ord.gt(DayJs.Ord)(DayJs.of('2020-01-01'), DayJs.of('2020-01-01'))).toStrictEqual(false)
    expectT(ord.gt(DayJs.Ord)(DayJs.of('2020-01-01'), DayJs.of('2020-01-02'))).toStrictEqual(false)
  })

  it('should Eq', () => {
    expectT(DayJs.Eq.equals(DayJs.of('2020-01-01'), DayJs.of('2020-01-01'))).toStrictEqual(true)
    expectT(DayJs.Eq.equals(DayJs.of('2020-01-01'), DayJs.of('2020-01-02'))).toStrictEqual(false)
    expectT(DayJs.Eq.equals(DayJs.of('2020-01-02'), DayJs.of('2020-01-01'))).toStrictEqual(false)
  })
})
