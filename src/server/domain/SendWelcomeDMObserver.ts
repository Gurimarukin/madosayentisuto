import type { GuildMember, MessageOptions } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { LogUtils } from '../utils/LogUtils'
import { MessageUtils } from '../utils/MessageUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const SendWelcomeDMObserver = (Logger: LoggerGetter) => {
  const logger = Logger('SendWelcomeDMObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'GuildMemberAdd',
  )(event => {
    const { member } = event
    const log = LogUtils.pretty(logger, member.guild)

    return pipe(
      log.info(`${member.user.tag} joined the guild`),
      Future.fromIOEither,
      Future.chain(() => DiscordConnector.sendMessage(member, welcomeMessage(member))),
      futureMaybe.matchE(
        () => Future.fromIOEither(log.warn(`Couldn't send greeting DM to ${member.user.tag}`)),
        () => Future.unit,
      ),
    )
  })
}

const welcomeMessage = (member: GuildMember): MessageOptions => ({
  content: StringUtils.stripMargins(
    `Ha ha !
    |Tu as rejoint le serveur **${member.guild.name}**, quelle erreur !
    |En guise de cadeau de bienvenue, découvre immédiatement l'histoire du véritable capitaine en cliquant sur ce lien plein de malice !
    |C'est comme OSS 117 mais en pirate.`,
  ),
  embeds: [
    MessageUtils.safeEmbed({
      color: constants.messagesColor,
      title: 'Jean Plank',
      url: 'https://jeanplank.blbl.ch',
      thumbnail: MessageUtils.thumbnail(
        'https://cdn.discordapp.com/attachments/636626556734930948/707502811600125962/thumbnail.jpg',
      ),
      description: 'Tout le monde doit payer !',
      image: MessageUtils.image(
        'https://cdn.discordapp.com/attachments/636626556734930948/707499903450087464/aide.jpg',
      ),
    }),
  ],
})
