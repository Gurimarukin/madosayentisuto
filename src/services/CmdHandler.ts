import { Message } from 'discord.js'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { Config } from '../config/Config'
import { Maybe, pipe, Future, List, Do, todo } from '../utils/fp'
import { MessageUtils } from '../utils/MessageUtils'

export const CmdHandler = (Logger: PartialLogger, config: Config, discord: DiscordConnector) => (
  message: Message
): Future<Maybe<Message>> => {
  const logger = Logger('CmdHandler')

  const regex = new RegExp(`^\\s*${config.cmdPrefix}\\s+(.*)$`, 'm')

  return pipe(
    logger.debug('got message:', message.content),
    Future.fromIOEither,
    // return none to prevent message from being passed to next message handler
    Future.chain(_ => {
      const isDm = MessageUtils.isDm(message)
      return pipe(
        isDm ? Maybe.some(message.content) : withoutPrefix(message.content),
        Maybe.fold(
          () => Future.right(Maybe.some(message)),
          _ =>
            pipe(
              Command.parse(isDm, _),
              handleOptCmd,
              Future.map(_ => Maybe.none)
            )
        )
      )
    })
  )

  function withoutPrefix(msg: string): Maybe<string> {
    return pipe(
      Maybe.fromNullable(msg.match(regex)),
      Maybe.chain(_ => List.lookup(1, _))
    )
  }

  function handleOptCmd(cmd: Maybe<Command>): Future<unknown> {
    return pipe(
      cmd,
      Maybe.fold(() => discord.sendMessage(message.channel, 'TINTIN ?!'), handleCmd)
    )
  }

  function handleCmd(cmd: Command): Future<unknown> {
    switch (cmd._tag) {
      case 'Tintin':
        return discord.sendMessage(message.channel, 'TINTIN.')

      case 'SpamUs':
        return Future.right(todo())

      case 'IgnoreCallsFrom':
        return Future.right(todo())
    }
  }
}

type Command = Command.Tintin | Command.SpamUs | Command.IgnoreCallsFrom

export namespace Command {
  export interface Tintin {
    _tag: 'Tintin'
  }
  export const Tintin: Command = { _tag: 'Tintin' }

  export interface SpamUs {
    _tag: 'SpamUs'
  }
  export const SpamUs: Command = { _tag: 'SpamUs' }

  export interface IgnoreCallsFrom {
    _tag: 'IgnoreCallsFrom'
    user: string
  }
  export const IgnoreCallsFrom = (user: string): Command => ({
    _tag: 'IgnoreCallsFrom',
    user
  })

  export const parse = (isDm: boolean, cmd: string): Maybe<Command> =>
    pipe(
      parseFirstWord(cmd),
      Maybe.chain(([first, remain]) =>
        pipe(
          parseTintin(first, remain),
          Maybe.alt(() => parseSpamUs(isDm, first, remain)),
          Maybe.alt(() => parseIgnoreCallsFrom(isDm, first, remain))
        )
      )
    )

  const parseTintin = (first: string, remain: Maybe<string>): Maybe<Command> =>
    pipe(
      first,
      Maybe.fromPredicate(_ => _ === 'tintin' && Maybe.isNone(remain)),
      Maybe.map(_ => Tintin)
    )

  const parseSpamUs = (isDm: boolean, first: string, remain: Maybe<string>): Maybe<Command> =>
    pipe(
      first,
      Maybe.fromPredicate(_ => _ === 'spamUs' && Maybe.isNone(remain) && !isDm),
      Maybe.map(_ => SpamUs)
    )

  const parseIgnoreCallsFrom = (
    isDm: boolean,
    first: string,
    remain: Maybe<string>
  ): Maybe<Command> =>
    pipe(
      first,
      Maybe.fromPredicate(_ => _ === 'ignoreCallsFrom' && !isDm),
      Maybe.chain(_ => remain),
      Maybe.chain(parseMention),
      Maybe.map(IgnoreCallsFrom)
    )
}

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
