import type { BaseMessageOptions, GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { constants } from '../config/constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MessageComponent } from '../models/discord/MessageComponent'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { LogUtils } from '../utils/LogUtils'

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
        () => Future.notUsed,
      ),
    )
  })
}

const welcomeMessage = (member: GuildMember): BaseMessageOptions => ({
  content: StringUtils.stripMargins(
    `Haha !
    |Tu as rejoint le serveur **${member.guild.name}**, quelle erreur !
    |En guise de cadeau de bienvenue, découvre immédiatement l'histoire du véritable capitaine en cliquant sur ce lien plein de malice !
    |C'est comme OSS 117, mais en pirate.`,
  ),
  embeds: [
    MessageComponent.safeEmbed({
      color: constants.messagesColor,
      title: 'Jean Plank',
      url: 'https://jeanplank.blbl.ch',
      thumbnail: MessageComponent.thumbnail(
        'https://cdn.discordapp.com/attachments/636626556734930948/707502811600125962/thumbnail.jpg',
      ),
      description: 'Tout le monde doit payer !',
      image: MessageComponent.image(
        'https://cdn.discordapp.com/attachments/636626556734930948/707499903450087464/aide.jpg',
      ),
    }),
  ],
})
