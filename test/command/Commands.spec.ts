import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/commands/Command'
import { Commands } from '../../src/commands/Commands'
import { TSnowflake } from '../../src/models/TSnowflake'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  const cmd = Cli('okb').adminTextChannel

  it('should parse "calls init <#channel> <@mention>"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'init', '<#channel>', '<@mention>']))).toStrictEqual(
      Either.right(Commands.CallsInit(TSnowflake.wrap('channel'), TSnowflake.wrap('mention')))
    )
  })

  it('should parse "defaultRole get"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'get']))).toStrictEqual(
      Either.right(Commands.DefaultRoleGet)
    )
  })

  it('should parse "defaultRole set <@toto>"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@toto>']))).toStrictEqual(
      Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto')))
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@!toto>']))).toStrictEqual(
      Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto')))
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@&toto>']))).toStrictEqual(
      Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto')))
    )
  })

  it('should return "Missing command" error for ""', () => {
    expect(pipe(cmd, Command.parse([]))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (calls or defaultRole)
          |
          |Usage:
          |    okb calls
          |    okb defaultRole
          |
          |Subcommands:
          |    calls
          |    defaultRole`
        )
      )
    )
  })

  it('should return "Missing command" error for "okb"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (get or set)
          |
          |Usage:
          |    okb defaultRole get
          |    okb defaultRole set
          |
          |Subcommands:
          |    get
          |    set`
        )
      )
    )
  })

  it('should return "Unexpected argument" error for "kallz"', () => {
    expect(pipe(cmd, Command.parse(['kallz']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: kallz
          |
          |Usage:
          |    okb calls
          |    okb defaultRole
          |
          |Subcommands:
          |    calls
          |    defaultRole`
        )
      )
    )
  })

  it('should return "Unexpected argument" error for "defaultRole retrieve"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'retrieve']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: retrieve
          |
          |Usage:
          |    okb defaultRole get
          |    okb defaultRole set
          |
          |Subcommands:
          |    get
          |    set`
        )
      )
    )
  })

  it('should correctly prioritize failures', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@toto>', 'a']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: a
          |
          |Usage: okb defaultRole set <role>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: okb defaultRole set <role>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: role
          |
          |Usage: okb defaultRole set <role>`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role', 'a']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: a
          |
          |Usage: okb defaultRole set <role>`
        )
      )
    )
  })

  it('should return Missing argument for "calls init"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'init']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: okb calls init <channel> <mention>`
        )
      )
    )
  })

  it('should return Missing argument for "calls init <#channel>"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'init', '<#channel>']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: okb calls init <channel> <mention>`
        )
      )
    )
  })

  it('should return Invalid channel for "calls init <@mention> <#channel>"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'init', '<@mention>', '<#channel>']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid channel: <@mention>
          |Invalid mention: <#channel>
          |
          |Usage: okb calls init <channel> <mention>`
        )
      )
    )
  })
})
