import { MessageEmbed } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { MadEvent } from '../../models/MadEvent'
import { Subscriber } from '../../models/Subscriber'
import { Colors } from '../../utils/Colors'
import { Future, IO, Maybe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { StringUtils } from '../../utils/StringUtils'
import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'

export const SendGreetingDMSubscriber = (
  Logger: PartialLogger,
  discord: DiscordConnector,
): Subscriber<MadEvent> => {
  const logger = Logger('SendGreetingDMSubscriber')

  return {
    next: event => {
      if (event.type === 'GuildMemberAdd') {
        const { member } = event
        return pipe(
          LogUtils.withGuild(logger, 'info', member.guild)(`${member.user.tag} joined the server`),
          Future.fromIOEither,
          Future.chain(() =>
            discord.sendMessage(member, {
              content: StringUtils.stripMargins(
                `Ha ha !
            |Tu as rejoint le serveur **${member.guild.name}**, quelle erreur !
            |En guise de cadeau de bienvenue, découvre immédiatement l'histoire du véritable capitaine en cliquant sur ce lien plein de malice !
            |(C'est comme OSS 117 mais en moins bien.)`,
              ),
              embeds: [
                new MessageEmbed()
                  .setColor(Colors.darkred)
                  .setTitle('Jean Plank')
                  .setURL('https://jeanplank.blbl.ch')
                  .setThumbnail(
                    'https://cdn.discordapp.com/attachments/636626556734930948/707502811600125962/thumbnail.jpg',
                  )
                  .setDescription('Tout le monde doit payer !')
                  .setImage(
                    'https://cdn.discordapp.com/attachments/636626556734930948/707499903450087464/aide.jpg',
                  ),
              ],
            }),
          ),
          Future.map(
            Maybe.fold(
              () => {}, // TODO: what to do if message wasn't sent?
              () => {},
            ),
          ),
          IO.runFuture,
        )
      }

      return IO.unit
    },
  }
}
