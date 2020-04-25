import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/commands/Command'
import { Commands } from '../../src/commands/Commands'
import { TSnowflake } from '../../src/models/TSnowflake'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  const cmd = Cli.adminTextChannel('okb')

  it('should parse "calls subscribe"', () => {
    expect(pipe(cmd, Command.parse(['okb', 'calls', 'subscribe']))).toEqual(
      Either.right(Commands.CallsSubscribe)
    )
  })

  it('should parse "okb calls unsubscribe"', () => {
    expect(pipe(cmd, Command.parse(['okb', 'calls', 'unsubscribe']))).toEqual(
      Either.right(Commands.CallsUnsubscribe)
    )
  })

  it('should parse "okb calls ignore @toto"', () => {
    expect(pipe(cmd, Command.parse(['okb', 'calls', 'ignore', '<@toto>']))).toEqual(
      Either.right(Commands.CallsIgnore(TSnowflake.wrap('toto')))
    )

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'ignore', '<@!toto>']))).toEqual(
      Either.right(Commands.CallsIgnore(TSnowflake.wrap('toto')))
    )
  })

  it('should return "Missing command" error for ""', () => {
    expect(pipe(cmd, Command.parse([]))).toEqual(
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
    expect(pipe(cmd, Command.parse(['okarin']))).toEqual(
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
    expect(pipe(cmd, Command.parse(['okb']))).toEqual(
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
    expect(pipe(cmd, Command.parse(['okb', 'kallz']))).toEqual(
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
    expect(pipe(cmd, Command.parse(['okb', 'calls']))).toEqual(
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
    expect(pipe(cmd, Command.parse(['okb', 'calls', 'follow']))).toEqual(
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

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'ignore', 'toto']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: toto
          |Usage:
          |    okb calls ignore <user>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'ignore', 'toto', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: toto
          |Usage:
          |    okb calls ignore <user>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['okb', 'calls', 'ignore', '<@toto>', 'a']))).toEqual(
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
