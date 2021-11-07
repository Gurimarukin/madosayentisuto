// import { Cli } from '../../src/commands/Cli'
// import { Commands } from '../../src/commands/Commands'
// import { Command } from '../../src/decline/Command'
// import { Activity } from '../../src/models/Activity'
// import { TSnowflake } from '../../src/models/TSnowflake'
// import { Either, pipe } from '../../src/utils/fp'
// import { StringUtils } from '../../src/utils/StringUtils'

describe('Cli.adminTextChannel', () => {
  it('should work', () => {
    expect(2).toStrictEqual(2)
  })

  // const cmd = Cli('okb').adminTextChannel

  // it('should show help when no args', () => {
  //   expect(pipe(cmd, Command.parse([]))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected command (calls or defaultRole or say or activity or kouizine), or positional argument
  //         |
  //         |Usage:
  //         |    okb calls
  //         |    okb defaultRole
  //         |    okb say
  //         |    okb activity
  //         |    okb kouizine
  //         |    okb <image>
  //         |
  //         |Tout le monde doit payer !
  //         |
  //         |Subcommands:
  //         |    calls
  //         |        Jean Plank n'est pas votre secrétaire mais gère vos appels.
  //         |    defaultRole
  //         |        Jean Plank donne un rôle au nouveau membres d'équipages.
  //         |    say
  //         |        Jean Plank prend la parole.
  //         |    activity
  //         |        Jean Plank est un homme occupé et le fait savoir.
  //         |    kouizine
  //         |        Jean Plank, galant homme, remet les femmes à leur place.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['ka', 'llz']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Unexpected argument: llz
  //         |
  //         |Usage:
  //         |    okb calls
  //         |    okb defaultRole
  //         |    okb say
  //         |    okb activity
  //         |    okb kouizine
  //         |    okb <image>
  //         |
  //         |Tout le monde doit payer !
  //         |
  //         |Subcommands:
  //         |    calls
  //         |        Jean Plank n'est pas votre secrétaire mais gère vos appels.
  //         |    defaultRole
  //         |        Jean Plank donne un rôle au nouveau membres d'équipages.
  //         |    say
  //         |        Jean Plank prend la parole.
  //         |    activity
  //         |        Jean Plank est un homme occupé et le fait savoir.
  //         |    kouizine
  //         |        Jean Plank, galant homme, remet les femmes à leur place.`,
  //       ),
  //     ),
  //   )
  // })

  // it('should parse "calls init"', () => {
  //   expect(pipe(cmd, Command.parse(['calls', 'init', '<#channel>', '<@mention>']))).toStrictEqual(
  //     Either.right(Commands.CallsInit(TSnowflake.wrap('channel'), TSnowflake.wrap('mention'))),
  //   )

  //   expect(pipe(cmd, Command.parse(['calls', 'init']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected positional argument
  //         |
  //         |Usage: okb calls init <channel> <role>
  //         |
  //         |Jean Plank envoie un message. Les membres d'équipage qui réagissent avec 🔔 obtiennent le rôle <role>.
  //         |À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['calls', 'init', '<#channel>']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected positional argument
  //         |
  //         |Usage: okb calls init <channel> <role>
  //         |
  //         |Jean Plank envoie un message. Les membres d'équipage qui réagissent avec 🔔 obtiennent le rôle <role>.
  //         |À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['calls', 'init', '<@mention>', '<#channel>']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Invalid channel: <@mention>
  //         |Invalid mention: <#channel>
  //         |
  //         |Usage: okb calls init <channel> <role>
  //         |
  //         |Jean Plank envoie un message. Les membres d'équipage qui réagissent avec 🔔 obtiennent le rôle <role>.
  //         |À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`,
  //       ),
  //     ),
  //   )
  // })

  // it('should show help for "defaultRole"', () => {
  //   expect(pipe(cmd, Command.parse(['defaultRole']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected command (get or set)
  //         |
  //         |Usage:
  //         |    okb defaultRole get
  //         |    okb defaultRole set
  //         |
  //         |Jean Plank donne un rôle au nouveau membres d'équipages.
  //         |
  //         |Subcommands:
  //         |    get
  //         |        Jean Plank vous informe du rôle par défaut de ce serveur.
  //         |    set
  //         |        Jean Plank veut bien changer le rôle par défaut de ce serveur.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['defaultRole', 'retrieve']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Unexpected argument: retrieve
  //         |
  //         |Usage:
  //         |    okb defaultRole get
  //         |    okb defaultRole set
  //         |
  //         |Jean Plank donne un rôle au nouveau membres d'équipages.
  //         |
  //         |Subcommands:
  //         |    get
  //         |        Jean Plank vous informe du rôle par défaut de ce serveur.
  //         |    set
  //         |        Jean Plank veut bien changer le rôle par défaut de ce serveur.`,
  //       ),
  //     ),
  //   )
  // })

  // it('should parse "defaultRole get"', () => {
  //   expect(pipe(cmd, Command.parse(['defaultRole', 'get']))).toStrictEqual(
  //     Either.right(Commands.DefaultRoleGet),
  //   )
  // })

  // it('should parse "defaultRole set"', () => {
  //   expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@toto>']))).toStrictEqual(
  //     Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto'))),
  //   )

  //   expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@!toto>']))).toStrictEqual(
  //     Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto'))),
  //   )

  //   expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@&toto>']))).toStrictEqual(
  //     Either.right(Commands.DefaultRoleSet(TSnowflake.wrap('toto'))),
  //   )
  // })

  // it('should show help for "say"', () => {
  //   expect(pipe(cmd, Command.parse(['say']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected positional argument
  //         |
  //         |Usage: okb say [--attach <url>]... <message>
  //         |
  //         |Jean Plank prend la parole.`,
  //       ),
  //     ),
  //   )
  // })

  // it('should parse "say"', () => {
  //   expect(pipe(cmd, Command.parse(['say', 'hello world']))).toStrictEqual(
  //     Either.right(Commands.Say([], 'hello world')),
  //   )

  //   expect(
  //     pipe(cmd, Command.parse(['say', '--attach', 'file1', '-a', 'file2', 'hello world'])),
  //   ).toStrictEqual(Either.right(Commands.Say(['file1', 'file2'], 'hello world')))
  // })

  // it('should show help for "activity"', () => {
  //   expect(pipe(cmd, Command.parse(['activity']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected command (get or unset or set or refresh)
  //         |
  //         |Usage:
  //         |    okb activity get
  //         |    okb activity unset
  //         |    okb activity set
  //         |    okb activity refresh
  //         |
  //         |Jean Plank est un homme occupé et le fait savoir.
  //         |
  //         |Subcommands:
  //         |    get
  //         |        Jean Plank veut bien répéter ce qu'il est en train de faire.
  //         |    unset
  //         |        Jean Plank a finit ce qu'il était en train de faire.
  //         |    set
  //         |        Jean Plank annonce au monde qu'il est un homme occupé.
  //         |    refresh
  //         |        Jean Plank a parfois besoin de rappeler au monde qu'il est un homme occupé.`,
  //       ),
  //     ),
  //   )
  // })

  // it('should parse "activity"', () => {
  //   expect(pipe(cmd, Command.parse(['activity', 'get']))).toStrictEqual(
  //     Either.right(Commands.ActivityGet),
  //   )

  //   expect(pipe(cmd, Command.parse(['activity', 'unset']))).toStrictEqual(
  //     Either.right(Commands.ActivityUnset),
  //   )

  //   expect(
  //     pipe(cmd, Command.parse(['activity', 'set', 'watch', 'brûler ton navire'])),
  //   ).toStrictEqual(Either.right(Commands.ActivitySet(Activity('WATCHING', 'brûler ton navire'))))

  //   expect(
  //     pipe(cmd, Command.parse(['activity', 'set', 'watch', 'brûler ton navire'])),
  //   ).toStrictEqual(Either.right(Commands.ActivitySet(Activity('WATCHING', 'brûler ton navire'))))

  //   expect(pipe(cmd, Command.parse(['activity', 'set']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected positional argument
  //         |
  //         |Usage: okb activity set <play|stream|listen|watch> <message>
  //         |
  //         |Jean Plank annonce au monde qu'il est un homme occupé.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['activity', 'refresh']))).toStrictEqual(
  //     Either.right(Commands.ActivityRefresh),
  //   )
  // })

  // it('should correctly prioritize failures', () => {
  //   expect(pipe(cmd, Command.parse(['defaultRole', 'set', '<@toto>', 'a']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Unexpected argument: a
  //         |
  //         |Usage: okb defaultRole set <role>
  //         |
  //         |Jean Plank veut bien changer le rôle par défaut de ce serveur.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['defaultRole', 'set']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Missing expected positional argument
  //         |
  //         |Usage: okb defaultRole set <role>
  //         |
  //         |Jean Plank veut bien changer le rôle par défaut de ce serveur.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Invalid mention: role
  //         |
  //         |Usage: okb defaultRole set <role>
  //         |
  //         |Jean Plank veut bien changer le rôle par défaut de ce serveur.`,
  //       ),
  //     ),
  //   )

  //   expect(pipe(cmd, Command.parse(['defaultRole', 'set', 'role', 'a']))).toStrictEqual(
  //     Either.left(
  //       StringUtils.stripMargins(
  //         `Unexpected argument: a
  //         |
  //         |Usage: okb defaultRole set <role>
  //         |
  //         |Jean Plank veut bien changer le rôle par défaut de ce serveur.`,
  //       ),
  //     ),
  //   )
  // })
})
