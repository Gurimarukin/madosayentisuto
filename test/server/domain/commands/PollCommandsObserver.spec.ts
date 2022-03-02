import { Either } from '../../../../src/shared/utils/fp'

import { parseAnswers } from '../../../../src/server/domain/commands/PollCommandsObserver'

describe('parseAnswers', () => {
  it('should parse valid answers 1', () => {
    expect(parseAnswers('"Une réponse" "Deux réponses"')).toStrictEqual(
      Either.right(['Une réponse', 'Deux réponses']),
    )
  })

  it('should parse valid answers 2', () => {
    expect(parseAnswers('"Une réponse""Deux réponses"')).toStrictEqual(
      Either.right(['Une réponse', 'Deux réponses']),
    )
  })

  it('should parse valid answers 3', () => {
    expect(parseAnswers('"Une réponse"')).toStrictEqual(Either.right(['Une réponse']))
  })

  it('should parse valid answers 4', () => {
    expect(parseAnswers('  "Une réponse""Deux réponses"  "Trois réponses"  ')).toStrictEqual(
      Either.right(['Une réponse', 'Deux réponses', 'Trois réponses']),
    )
  })

  it('should fail for empty answer', () => {
    expect(parseAnswers('"Une réponse" ""')).toStrictEqual(
      Either.left('Une réponse ne peut être vide'),
    )
  })

  it('should fail for no answers', () => {
    expect(parseAnswers('')).toStrictEqual(Either.left('Au moins une réponse est requise'))
  })

  it('should fail for invalid syntax 1', () => {
    expect(parseAnswers(' qsddfq "Une réponse"')).toStrictEqual(
      Either.left('Les réponses doivent être entourées de guillemets'),
    )
  })

  it('should fail for invalid syntax 2', () => {
    expect(parseAnswers('"Une réponse" "Deux réponses')).toStrictEqual(
      Either.left('Les réponses doivent être entourées de guillemets'),
    )
  })
})
