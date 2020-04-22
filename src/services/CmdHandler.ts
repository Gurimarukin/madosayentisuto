import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import { Message } from 'discord.js'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { Config } from '../config/Config'
import { ObservableE } from '../models/ObservableE'
import { Maybe, pipe, Future, List, Do, todo } from '../utils/fp'
import { MessageUtils } from '../utils/MessageUtils'

export const CmdHandler = (Logger: PartialLogger, config: Config, discord: DiscordConnector) => (
  messages: ObservableE<Message>
): ObservableE<Maybe<Message>> => {
  const logger = Logger('CmdHandler')

  const regex = new RegExp(`^\\s*${config.cmdPrefix}\\s+(.*)$`, 'm')

  return pipe(
    messages,
    Obs.chain(msg =>
      pipe(
        Obs.fromIOEither(logger.debug('got msg:', msg.content)),
        Obs.map(_ => msg)
      )
    ),
    Obs.chain(_ => pipe(handleMessage(_), Obs.fromTaskEither))
  )

  // return none to prevent message from being passed to next message handler
  function handleMessage(message: Message): Future<Maybe<Message>> {
    return pipe(
      MessageUtils.isDm(message) ? Maybe.some(message.content) : withoutPrefix(message.content),
      Maybe.chain(Command.parse),
      Maybe.fold(
        () =>
          pipe(
            discord.sendMessage(message.channel, 'TINTIN ?!'),
            Future.map(_ => Maybe.some(message))
          ),
        handleCmd
      )
    )
  }

  function withoutPrefix(msg: string): Maybe<string> {
    return pipe(
      Maybe.fromNullable(msg.match(regex)),
      Maybe.chain(_ => List.lookup(1, _))
    )
  }

  function handleCmd(cmd: Command): Future<Maybe<Message>> {
    console.log('cmd =', cmd)
    switch (cmd._tag) {
      case 'SpamUs':
        return Future.right(todo())

      case 'IgnoreCallsFrom':
        return Future.right(todo())
    }
  }
}

type Command = Command.SpamUs | Command.IgnoreCallsFrom

export namespace Command {
  export interface SpamUs {
    _tag: 'SpamUs'
    prefix: 'spamUs'
  }
  export const SpamUs: Command = { _tag: 'SpamUs', prefix: 'spamUs' }

  export interface IgnoreCallsFrom {
    _tag: 'IgnoreCallsFrom'
    prefix: 'ignoreCallsFrom'
    user: string
  }
  const ignoreCallsFromPrefix: IgnoreCallsFrom['prefix'] = 'ignoreCallsFrom'
  export const IgnoreCallsFrom = (user: string): Command => ({
    _tag: 'IgnoreCallsFrom',
    prefix: ignoreCallsFromPrefix,
    user
  })

  export const parse = (cmd: string): Maybe<Command> =>
    pipe(
      parseFirstWord(cmd),
      Maybe.chain(([first, remain]) =>
        pipe(
          parseSpamUs(first, remain),
          Maybe.alt(() => parseIgnoreCallsFrom(first, remain))
        )
      )
    )

  const parseSpamUs = (first: string, remain: Maybe<string>): Maybe<Command> =>
    pipe(
      first,
      Maybe.fromPredicate(_ => _ === SpamUs.prefix && Maybe.isNone(remain)),
      Maybe.map(_ => SpamUs)
    )

  const parseIgnoreCallsFrom = (first: string, remain: Maybe<string>): Maybe<Command> =>
    pipe(
      first,
      Maybe.fromPredicate(_ => _ === ignoreCallsFromPrefix),
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
