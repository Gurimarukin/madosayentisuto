import { apply } from 'fp-ts'

import { Command } from '../../src/decline/Command'
import { Opts } from '../../src/decline/Opts'
import { Either, Maybe, pipe } from '../../src/utils/fp'
import { StringUtils } from '../../src/utils/StringUtils'

const prefix = Command({
  name: 'toto',
  header: '',
})

describe('Cli.option', () => {
  const cmd = prefix(
    Opts.option(Either.right)({
      long: 'attach',
      help: '',
      short: 'a',
      metavar: 'file',
    }),
  )

  it('should parse', () => {
    expect(pipe(cmd, Command.parse(['--attach', 'file']))).toStrictEqual(Either.right('file'))
    expect(pipe(cmd, Command.parse(['-a', 'file']))).toStrictEqual(Either.right('file'))
    expect(pipe(cmd, Command.parse(['-a', 'file1', '-a', 'file2']))).toStrictEqual(
      Either.right('file2'),
    )
  })

  it('should show help for missing option', () => {
    expect(pipe(cmd, Command.parse([]))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Usage: toto --attach <file>
          |
          |`,
        ),
      ),
    )
  })

  it('should show help for missing option value', () => {
    expect(pipe(cmd, Command.parse(['-a']))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing value for option: -a
          |
          |Usage: toto --attach <file>
          |
          |`,
        ),
      ),
    )
  })
})

describe('Opts.params', () => {
  const cmd = prefix(Opts.params(Either.right)('things'))

  it('should parse', () => {
    expect(pipe(cmd, Command.parse(['thing1']))).toStrictEqual(Either.right(['thing1']))
    expect(pipe(cmd, Command.parse(['thing1', 'thing2']))).toStrictEqual(
      Either.right(['thing1', 'thing2']),
    )
  })

  it('should show help for missing params', () => {
    expect(pipe(cmd, Command.parse([]))).toStrictEqual(
      Either.left(
        StringUtils.stripMargins(
          `Missing expected positional argument
          |
          |Usage: toto <things>...
          |
          |`,
        ),
      ),
    )
  })
})

describe('Opts.orNone', () => {
  const cmd = prefix(
    pipe(
      Opts.option(Either.right)({
        long: 'attach',
        help: '',
        short: 'a',
        metavar: 'file',
      }),
      Opts.orNone,
    ),
  )

  it('should parse', () => {
    expect(pipe(cmd, Command.parse([]))).toStrictEqual(Either.right(Maybe.none))
    expect(pipe(cmd, Command.parse(['-a', 'file']))).toStrictEqual(Either.right(Maybe.some('file')))
  })
})

describe('Opts.orEmpty', () => {
  const cmd = prefix(pipe(Opts.params(Either.right)('thing'), Opts.orEmpty))

  it('should parse', () => {
    expect(pipe(cmd, Command.parse([]))).toStrictEqual(Either.right([]))
    expect(pipe(cmd, Command.parse(['file']))).toStrictEqual(Either.right(['file']))
    expect(pipe(cmd, Command.parse(['file2', 'file2']))).toStrictEqual(
      Either.right(['file2', 'file2']),
    )
  })
})

describe('complex cases', () => {
  it('case 1', () => {
    const cmd = prefix(
      apply.sequenceT(Opts.opts)(
        Opts.param(Either.right)('arg'),
        Opts.params(Either.right)('thing'),
      ),
    )

    expect(pipe(cmd, Command.parse(['titi', 'thing1', 'thing2']))).toStrictEqual(
      Either.right(['titi', ['thing1', 'thing2']]),
    )
  })

  it('case 2', () => {
    const cmd = prefix(
      apply.sequenceT(Opts.opts)(
        Opts.options(Either.right)({
          long: 'attach',
          help: '',
          metavar: 'file',
          short: 'a',
        }),
        Opts.params(Either.right)('thing'),
      ),
    )

    expect(
      pipe(cmd, Command.parse(['-a', 'file1', '--attach', 'file2', 'hello', 'world'])),
    ).toStrictEqual(
      Either.right([
        ['file1', 'file2'],
        ['hello', 'world'],
      ]),
    )
  })
})
