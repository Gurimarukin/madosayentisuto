import util from 'util'
import { sequenceT } from 'fp-ts/lib/Apply'
import { Eq, fromEquals } from 'fp-ts/lib/Eq'

import { Command } from './Command'
import { Opts } from './Opts'
import { Usage } from './Usage'
import { NonEmptyArray, pipe, List, Maybe } from '../utils/fp'
import { StringUtils } from '../utils/StringUtils'

export interface Help {
  readonly errors: string[]
  readonly prefix: NonEmptyArray<string>
  readonly usage: string[]
  readonly body: string[]
}

export namespace Help {
  /**
   * methods
   */
  export const withErrors = (moreErrors: string[]) => (help: Help): Help => ({
    ...help,
    errors: List.concat(help.errors, moreErrors)
  })

  export const withPrefix = (prefix: string[]) => (help: Help): Help => ({
    ...help,
    prefix: pipe(prefix, List.reduceRight(help.prefix, List.cons))
  })

  export const stringify = (help: Help): string => {
    const maybeErrors = List.isEmpty(help.errors)
      ? List.empty
      : pipe(help.errors, StringUtils.mkString('\n'), List.of)
    const prefixString = pipe(help.prefix, StringUtils.mkString(' '))
    const usageString = List.isEmpty(help.usage)
      ? `Usage: ${prefixString}`
      : help.usage.length === 1
      ? `Usage: ${prefixString} ${help.usage[0]}`
      : pipe(List.cons('Usage:', help.usage), StringUtils.mkString(`\n    ${prefixString} `))

    return pipe(
      List.concat(maybeErrors, List.cons(usageString, help.body)),
      StringUtils.mkString('\n\n')
    )
  }

  /**
   * helpers
   */
  export const fromCommand = (parser: Command<unknown>): Help => {
    const commands = commandList(parser.opts)

    const commandHelp = List.isEmpty(commands)
      ? List.empty
      : pipe(
          commands,
          List.chain(command => List.of(withIndent(4, command.name))),
          texts => pipe(List.cons('Subcommands:', texts), StringUtils.mkString('\n'), List.of)
        )

    const optionsDetail = detail(parser.opts)
    const optionsHelp = List.isEmpty(optionsDetail)
      ? List.empty
      : pipe(List.cons('Options:', optionsDetail), StringUtils.mkString('\n'), List.of)

    return {
      errors: List.empty,
      prefix: NonEmptyArray.of(parser.name),
      usage: pipe(Usage.fromOpts(parser.opts), List.chain(Usage.show)),
      body: List.concat(optionsHelp, commandHelp)
    }
  }

  const optionList = (opts: Opts<unknown>): Maybe<[Opts.Opt<unknown>, boolean][]> => {
    switch (opts._tag) {
      case 'Pure':
        return Maybe.some(List.empty)

      case 'App':
        return pipe(
          sequenceT(Maybe.option)(optionList(opts.f), optionList(opts.a)),
          Maybe.map(([a, b]) => List.concat(a, b))
        )

      case 'OrElse':
        const b = optionList(opts.b)
        return pipe(
          optionList(opts.a),
          Maybe.map(a =>
            pipe(
              b,
              Maybe.fold(
                () => a,
                _ => List.concat(a, _)
              )
            )
          ),
          Maybe.alt(() => b)
        )

      case 'Single':
        return Maybe.some(List.of([opts.opt, false]))

      case 'Repeated':
        return Maybe.some(List.of([opts.opt, true]))

      case 'Subcommand':
        return Maybe.some(List.empty)

      case 'Validate':
        return optionList(opts.value)
    }
  }

  const commandList = (opts: Opts<unknown>): Command<unknown>[] => {
    switch (opts._tag) {
      case 'App':
        return List.concat(commandList(opts.f), commandList(opts.a))

      case 'OrElse':
        return List.concat(commandList(opts.a), commandList(opts.b))

      case 'Subcommand':
        return List.of(opts.command)

      case 'Validate':
        return commandList(opts.value)

      default:
        return List.empty
    }
  }

  const detail = (opts: Opts<unknown>): string[] =>
    pipe(
      optionList(opts),
      Maybe.getOrElse<[Opts.Opt<unknown>, boolean][]>(() => List.empty),
      List.uniq(eqDeepStrict),
      List.chain(
        ([_opt, _]) =>
          // if (opt._tag === 'Regular') ???
          // if (opt._tag === 'Flag') ???
          List.empty
      )
    )

  const withIndent = (indent: number, str: string): string => {
    const tab = ' '.repeat(indent)
    return pipe(
      str.split('\n'),
      List.map(_ => `${tab}${_}`),
      StringUtils.mkString('\n')
    )
  }
}

const eqDeepStrict: Eq<[Opts.Opt<unknown>, boolean]> = fromEquals((a, b) =>
  util.isDeepStrictEqual(a, b)
)
