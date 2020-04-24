import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/commands/Command'
import { Commands } from '../../src/commands/Commands'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  it('should parse "okb calls subscribe"', () => {
    const args = ['okb', 'calls', 'subscribe']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(Either.right(Commands.CallsSubscribe))
  })

  it('should parse "okb calls unsubscribe"', () => {
    const args = ['okb', 'calls', 'unsubscribe']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(Either.right(Commands.CallsUnsubscribe))
  })

  it('should parse "okb calls unsubscribe unused"', () => {
    const args = ['okb', 'calls', 'unsubscribe', 'unused']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    okb calls subscribe
          |    okb calls unsubscribe`
        )
      )
    )
  })

  it('should return help for ""', () => {
    const result = pipe(Cli.adminTextChannel, Command.parse([]))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (okb)
          |Usage:
          |    okb`
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
          |    okb`
        )
      )
    )
  })

  it('should return help for "okb"', () => {
    const args = ['okb']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (calls)
          |Usage:
          |    okb calls`
        )
      )
    )
  })

  it('should return help for "okb calls"', () => {
    const args = ['okb', 'calls']
    const result = pipe(Cli.adminTextChannel, Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (subscribe or unsubscribe)
          |Usage:
          |    okb calls subscribe
          |    okb calls unsubscribe`
        )
      )
    )
  })
})
