import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/commands/Command'
import { Commands } from '../../src/commands/Commands'
import { TSnowflake } from '../../src/models/TSnowflake'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  const cmd = Cli.adminTextChannel('okb')

  it('should parse "calls init"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'init']))).toEqual(Either.right(Commands.CallsInit))
  })

  it('should parse "defaultRole get"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'get']))).toEqual(
      Either.right(Commands.DefaultRoleGet)
    )
  })

  it('should parse "defaultRole set <@toto>"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@toto>']))).toEqual(
      Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto')))
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@!toto>']))).toEqual(
      Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto')))
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@&toto>']))).toEqual(
      Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto')))
    )
  })

  it('should return "Missing command" error for ""', () => {
    expect(pipe(cmd, Command.parse([]))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (calls or defaultRole)
          |Usage:
          |    okb calls
          |    okb defaultRole`
        )
      )
    )
  })

  it('should return "Missing command" error for "defaultRole"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (get or set)
          |Usage:
          |    okb defaultRole get
          |    okb defaultRole set <role>`
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
          |    okb calls
          |    okb defaultRole`
        )
      )
    )
  })

  it('should return "Unexpected argument" error for "defaultRole gett"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'retrieve']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: retrieve
          |Usage:
          |    okb defaultRole get
          |    okb defaultRole set <role>`
        )
      )
    )
  })

  it('should correctly prioritize failures', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@toto>', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `To many arguments
          |Usage:
          |    okb defaultRole set <role>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected argument: <role>
          |Usage:
          |    okb defaultRole set <role>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: role
          |Usage:
          |    okb defaultRole set <role>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role', 'a']))).toEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: role
          |Usage:
          |    okb defaultRole set <role>`
        )
      )
    )
  })
})
