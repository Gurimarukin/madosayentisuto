import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/commands/Command'
import { Commands } from '../../src/commands/Commands'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  it('should parse "calls subscribe"', () => {
    const args = ['okb', 'calls', 'subscribe']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
    expect(result).toEqual(Either.right(Commands.CallsSubscribe))
  })

  it('should parse "okb calls unsubscribe"', () => {
    const args = ['okb', 'calls', 'unsubscribe']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
    expect(result).toEqual(Either.right(Commands.CallsUnsubscribe))
  })

  it('should parse "okb calls ignore toto"', () => {
    const args = ['okb', 'calls', 'ignore', 'toto']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
    expect(result).toEqual(Either.right(Commands.CallsIgnore('toto')))
  })

  it('should return "Missing command" error for ""', () => {
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse([]))
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

  it('should return "Unexpected argument" error for "okarin"', () => {
    const args = ['okarin']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: okarin
          |Usage:
          |    okb`
        )
      )
    )
  })

  it('should return "Missing command" error for "okb"', () => {
    const args = ['okb']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
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

  it('should return "Unexpected argument" error for "okb kallz"', () => {
    const args = ['okb', 'kallz']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: kallz
          |Usage:
          |    okb calls`
        )
      )
    )
  })

  it('should return "Missing command" error for "okb calls"', () => {
    const args = ['okb', 'calls']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (subscribe or unsubscribe or ignore)
          |Usage:
          |    okb calls subscribe
          |    okb calls unsubscribe
          |    okb calls ignore <user>`
        )
      )
    )
  })

  it('should return "Unexpected argument" error for "okb calls follow"', () => {
    const args = ['okb', 'calls', 'follow']
    const result = pipe(Cli.adminTextChannel('okb'), Command.parse(args))
    expect(result).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: follow
          |Usage:
          |    okb calls subscribe
          |    okb calls unsubscribe
          |    okb calls ignore <user>`
        )
      )
    )
  })

  it('should correctly prioritize failures', () => {
    const cmd = Cli.adminTextChannel('okb')

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'subscribe', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    okb calls subscribe`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'unsubscribe', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    okb calls unsubscribe`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'ignore']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected argument: <user>
          |Usage:
          |    okb calls ignore <user>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'ignore', 'toto', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    okb calls ignore <user>`
        )
      )
    )
  })
})
