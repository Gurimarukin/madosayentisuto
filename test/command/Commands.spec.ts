import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/commands/Command'
import { Commands } from '../../src/commands/Commands'
import { TSnowflake } from '../../src/models/TSnowflake'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  const cmd = Cli.adminTextChannel('okb')

  it('should parse "calls subscribe"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'subscribe']))).toEqual(
      Either.right(Commands.CallsSubscribe)
    )
  })

  it('should parse "calls unsubscribe"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'unsubscribe']))).toEqual(
      Either.right(Commands.CallsUnsubscribe)
    )
  })

  it('should parse "calls ignore @toto"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'ignore', '<@toto>']))).toEqual(
      Either.right(Commands.CallsIgnore(TSnowflake.wrap('toto')))
    )

    expect(pipe(cmd, Command.parse(['calls', 'ignore', '<@!toto>']))).toEqual(
      Either.right(Commands.CallsIgnore(TSnowflake.wrap('toto')))
    )
  })

  it('should return "Missing command" error for ""', () => {
    expect(pipe(cmd, Command.parse([]))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (calls)
          |Usage:
          |    okb calls`
        )
      )
    )
  })

  it('should return "Missing command" error for "calls"', () => {
    expect(pipe(cmd, Command.parse(['calls']))).toEqual(
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

  it('should return "Unexpected argument" error for "kallz"', () => {
    expect(pipe(cmd, Command.parse(['kallz']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: kallz
          |Usage:
          |    okb calls`
        )
      )
    )
  })

  it('should return "Unexpected argument" error for "calls follow"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'follow']))).toEqual(
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
    expect(pipe(cmd, Command.parse(['calls', 'subscribe', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    okb calls subscribe`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['calls', 'unsubscribe', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    okb calls unsubscribe`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['calls', 'ignore']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected argument: <user>
          |Usage:
          |    okb calls ignore <user>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['calls', 'ignore', 'toto']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: toto
          |Usage:
          |    okb calls ignore <user>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['calls', 'ignore', 'toto', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: toto
          |Usage:
          |    okb calls ignore <user>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['calls', 'ignore', '<@toto>', 'a']))).toEqual(
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
