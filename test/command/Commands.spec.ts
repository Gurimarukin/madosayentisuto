import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/commands/Command'
import { Commands } from '../../src/commands/Commands'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  it('should parse "calls subscribe"', () => {
    const args = ['calls', 'subscribe']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(Either.right(Commands.CallsSubscribe))
  })

  it('should parse "calls unsubscribe"', () => {
    const args = ['calls', 'unsubscribe']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(Either.right(Commands.CallsUnsubscribe))
  })

  it('should parse "okb calls unsubscribe unused"', () => {
    const args = ['calls', 'unsubscribe', 'unused']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    calls subscribe
          |    calls unsubscribe`
        )
      )
    )
  })

  it('should return help for ""', () => {
    const result = pipe(Cli.adminTextChannel, Command.parse([]))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (calls)
          |Usage:
          |    calls`
        )
      )
    )
  })

  it('should return help for "baka"', () => {
    const args = ['baka']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: baka
          |Usage:
          |    calls`
        )
      )
    )
  })

  it('should return help for "calls baka"', () => {
    const args = ['calls', 'baka']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: baka
          |Usage:
          |    calls subscribe
          |    calls unsubscribe`
        )
      )
    )
  })
})
