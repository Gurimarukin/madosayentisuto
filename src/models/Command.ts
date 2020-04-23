import { Maybe, pipe, List, Do } from '../utils/fp'

export type Command = Command.Tintin | Command.SpamUsHere | Command.IgnoreCallsFrom

export namespace Command {
  export interface Tintin {
    readonly _tag: 'Tintin'
  }
  export const Tintin: Command = { _tag: 'Tintin' }

  export interface SpamUsHere {
    readonly _tag: 'SpamUsHere'
  }
  export const SpamUsHere: Command = { _tag: 'SpamUsHere' }

  export interface IgnoreCallsFrom {
    readonly _tag: 'IgnoreCallsFrom'
    readonly user: string
  }
  export const IgnoreCallsFrom = (user: string): Command => ({
    _tag: 'IgnoreCallsFrom',
    user
  })

  export const parse = (cmd: string): Maybe<Command> =>
    pipe(
      parseFirstWord(cmd),
      Maybe.chain(([first, remain]) =>
        pipe(
          parseTintin(first, remain),
          Maybe.alt(() => parseSpamUsHere(first, remain)),
          Maybe.alt(() => parseIgnoreCallsFrom(first, remain))
        )
      )
    )
}

const parseTintin = (first: string, remain: Maybe<string>): Maybe<Command> =>
  pipe(
    withPrefix(first, 'tintin'),
    Maybe.filter(_ => Maybe.isNone(remain)),
    Maybe.map(_ => Command.Tintin)
  )

const parseSpamUsHere = (first: string, remain: Maybe<string>): Maybe<Command> =>
  pipe(
    withPrefix(first, 'spamUsHere'),
    Maybe.filter(_ => Maybe.isNone(remain)),
    Maybe.map(_ => Command.SpamUsHere)
  )

const parseIgnoreCallsFrom = (first: string, remain: Maybe<string>): Maybe<Command> =>
  pipe(
    withPrefix(first, 'ignoreCallsFrom'),
    Maybe.chain(_ => remain),
    Maybe.chain(parseMention),
    Maybe.map(Command.IgnoreCallsFrom)
  )

const withPrefix = (first: string, prefix: string): Maybe<string> =>
  pipe(
    first,
    Maybe.fromPredicate(_ => _ === prefix)
  )

const firstWordRegex = /^\s*(\w+)(.*)$/m
const parseFirstWord = (str: string): Maybe<[string, Maybe<string>]> =>
  Do(Maybe.option)
    .bind('match', Maybe.fromNullable(str.match(firstWordRegex)))
    .bindL('firstWord', ({ match }) => List.lookup(1, match))
    .bindL('remain', ({ match }) => List.lookup(2, match))
    .return(({ firstWord, remain }) => [
      firstWord,
      pipe(
        Maybe.some(remain),
        Maybe.map(_ => _.trim()),
        Maybe.filter(_ => _ !== '')
      )
    ])

const mentionRegex = /^\s*<@\!?(\w+)>.*$/
const parseMention = (str: string): Maybe<string> =>
  pipe(
    Maybe.fromNullable(str.match(mentionRegex)),
    Maybe.chain(_ => List.lookup(1, _))
  )
