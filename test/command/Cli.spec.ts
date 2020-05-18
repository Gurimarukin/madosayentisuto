import { Cli } from '../../src/commands/Cli'
import { Command } from '../../src/decline/Command'
import { Commands } from '../../src/commands/Commands'
import { TSnowflake } from '../../src/models/TSnowflake'
import { Either, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  const cmd = Cli('okb').adminTextChannel

  it('should show help when no args', () => {
    expect(pipe(cmd, Command.parse([]))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (calls or defaultRole or say)
          |
          |Usage:
          |    okb calls
          |    okb defaultRole
          |    okb say
          |
          |Everyone pays!
          |
          |Subcommands:
          |    calls
          |        When someone joins a voice channel and he is the only one connected to a public voice channel.
          |    defaultRole
          |        Role for new members of this server.
          |    say
          |        Make the bot say something.`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['kallz']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: kallz
          |
          |Usage:
          |    okb calls
          |    okb defaultRole
          |    okb say
          |
          |Everyone pays!
          |
          |Subcommands:
          |    calls
          |        When someone joins a voice channel and he is the only one connected to a public voice channel.
          |    defaultRole
          |        Role for new members of this server.
          |    say
          |        Make the bot say something.`
        )
      )
    )
  })

  it('should parse "calls init"', () => {
    expect(pipe(cmd, Command.parse(['calls', 'init', '<#channel>', '<@mention>']))).toStrictEqual(
      Either.right(Commands.CallsInit(TSnowflake.wrap('channel'), TSnowflake.wrap('mention')))
    )

    expect(pipe(cmd, Command.parse(['calls', 'init']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: okb calls init <channel> <role>
          |
          |Sends a message. Members reacting to it with 🔔 are added to the <role>.
          |After that, when a calls starts in this server, it will be notified in <channel> by mentionning <role>.`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['calls', 'init', '<#channel>']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: okb calls init <channel> <role>
          |
          |Sends a message. Members reacting to it with 🔔 are added to the <role>.
          |After that, when a calls starts in this server, it will be notified in <channel> by mentionning <role>.`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['calls', 'init', '<@mention>', '<#channel>']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid channel: <@mention>
          |Invalid mention: <#channel>
          |
          |Usage: okb calls init <channel> <role>
          |
          |Sends a message. Members reacting to it with 🔔 are added to the <role>.
          |After that, when a calls starts in this server, it will be notified in <channel> by mentionning <role>.`
        )
      )
    )
  })

  it('should show help for "defaultRole"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected command (get or set)
          |
          |Usage:
          |    okb defaultRole get
          |    okb defaultRole set
          |
          |Role for new members of this server.
          |
          |Subcommands:
          |    get
          |        Show the default role for this server.
          |    set
          |        Set the default role for this server.`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'retrieve']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: retrieve
          |
          |Usage:
          |    okb defaultRole get
          |    okb defaultRole set
          |
          |Role for new members of this server.
          |
          |Subcommands:
          |    get
          |        Show the default role for this server.
          |    set
          |        Set the default role for this server.`
        )
      )
    )
  })

  it('should parse "defaultRole get"', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'get']))).toStrictEqual(
      Either.right(Commands.DefaultRoleGet)
    )
  })

  it('should parse "defaultRole set"', () => {
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

  it('should show help for "say"', () => {
    expect(pipe(cmd, Command.parse(['say']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: okb say [--attach <url>]... <message>
          |
          |Make the bot say something.`
        )
      )
    )
  })

  it('should parse "say"', () => {
    expect(pipe(cmd, Command.parse(['say', 'hello world']))).toStrictEqual(
      Either.right(Commands.Say([], 'hello world'))
    )

    expect(
      pipe(cmd, Command.parse(['say', '--attach', 'file1', '-a', 'file2', 'hello world']))
    ).toStrictEqual(Either.right(Commands.Say(['file1', 'file2'], 'hello world')))
  })

  it('should correctly prioritize failures', () => {
    expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@toto>', 'a']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: a
          |
          |Usage: okb defaultRole set <role>
          |
          |Set the default role for this server.`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: okb defaultRole set <role>
          |
          |Set the default role for this server.`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Invalid mention: role
          |
          |Usage: okb defaultRole set <role>
          |
          |Set the default role for this server.`
        )
      )
    )

    expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role', 'a']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Unexpected argument: a
          |
          |Usage: okb defaultRole set <role>
          |
          |Set the default role for this server.`
        )
      )
    )
  })
})
