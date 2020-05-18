import { StringUtils } from '../../src/utils/StringUtils'

describe('StringUtils.splitWords', () => {
  it('should split words', () => {
    expect(StringUtils.splitWords('toto  titi')).toStrictEqual(['toto', 'titi'])
    expect(StringUtils.splitWords('toto titi')).toStrictEqual(['toto', 'titi']) // nbsp
    expect(StringUtils.splitWords('toto\ttiti')).toStrictEqual(['toto', 'titi'])
    expect(
      StringUtils.splitWords(
        `toto\n\n
         titi`
      )
    ).toStrictEqual(['toto', 'titi'])
  })
})
