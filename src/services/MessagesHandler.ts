import { Message } from 'discord.js'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { Config } from '../config/Config'
import { Command } from '../models/Command'
import { Maybe, pipe, Future, List, todo } from '../utils/fp'
import { MessageUtils } from '../utils/MessageUtils'

export const MessagesHandler = (
  Logger: PartialLogger,
  config: Config,
  discord: DiscordConnector
): ((message: Message) => Future<unknown>) => {
  const logger = Logger('CmdHandler')

  const regex = new RegExp(`^\\s*${config.cmdPrefix}\\s+(.*)$`, 'm')

  return message =>
    discord.isFromSelf(message)
      ? Future.unit
      : pipe(
          logger.debug('got message:', message.content),
          Future.fromIOEither,
          Future.chain(_ => handleMessage(message))
        )

  function handleMessage(message: Message): Future<unknown> {
    return pipe(
      pong(message),
      Maybe.alt(() => handleCommand(message)),
      Maybe.getOrElse<Future<unknown>>(() => Future.unit)
    )
  }

  function pong(message: Message): Maybe<Future<unknown>> {
    return message.content.trim() === 'ping'
      ? Maybe.some(discord.sendMessage(message.channel, 'pong'))
      : Maybe.none
  }

  function handleCommand(message: Message): Maybe<Future<unknown>> {
    const isDm = MessageUtils.isDm(message.channel)
    return pipe(
      isDm ? Maybe.some(message.content) : withoutPrefix(message.content),
      Maybe.map(_ => pipe(_, Command.parse, handleOptCmd(message)))
    )
  }

  function withoutPrefix(msg: string): Maybe<string> {
    return pipe(
      Maybe.fromNullable(msg.match(regex)),
      Maybe.chain(_ => List.lookup(1, _))
    )
  }

  function handleOptCmd(message: Message): (cmd: Maybe<Command>) => Future<unknown> {
    return Maybe.fold(() => discord.sendMessage(message.channel, 'TINTIN ?!'), handleCmd(message))
  }

  function handleCmd(message: Message): (cmd: Command) => Future<unknown> {
    return cmd => {
      switch (cmd._tag) {
        case 'Tintin':
          return discord.sendMessage(message.channel, 'TINTIN.')

        case 'SpamUsHere':
          return Future.right(todo(message.channel))

        case 'IgnoreCallsFrom':
          return Future.right(todo(cmd.user))
      }
    }
  }
}
