import { Maybe } from '../../src/utils/fp'
import { longOpt, longOptWithEquals, shortOpt } from '../../src/commands/Parser'

describe('longOpt', () => {
  it('should parse "--toto"', () => {
    expect(longOpt('--toto')).toStrictEqual(Maybe.some('toto'))
  })
})

describe('longOptWithEquals', () => {
  it('should parse "--toto=titi"', () => {
    expect(longOptWithEquals('--toto=titi')).toStrictEqual(Maybe.some(['toto', 'titi']))
  })
})

describe('shortOpt', () => {
  it('should parse "-abc"', () => {
    expect(shortOpt('-abc')).toStrictEqual(Maybe.some(['a', 'bc']))
  })
})
