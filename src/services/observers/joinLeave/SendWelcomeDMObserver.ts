import { MessageEmbed } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { GuildMemberAdd } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Colors } from '../../../utils/Colors'
import { Future, Maybe } from '../../../utils/fp'
import { LogUtils } from '../../../utils/LogUtils'
import { StringUtils } from '../../../utils/StringUtils'
import { DiscordConnector } from '../../DiscordConnector'
import { PartialLogger } from '../../Logger'

export const SendWelcomeDMObserver = (Logger: PartialLogger): TObserver<GuildMemberAdd> => {
  const logger = Logger('SendWelcomeDMObserver')

  return {
    next: event => {
      const { member } = event
      return pipe(
        LogUtils.withGuild(logger, 'info', member.guild)(`${member.user.tag} joined the guild`),
        Future.fromIOEither,
        Future.chain(() =>
          DiscordConnector.sendMessage(member, {
            content: StringUtils.stripMargins(
              `Ha ha !
              |Tu as rejoint le serveur **${member.guild.name}**, quelle erreur !
              |En guise de cadeau de bienvenue, découvre immédiatement l'histoire du véritable capitaine en cliquant sur ce lien plein de malice !
              |C'est comme OSS 117 mais en moins bien.`,
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
        Future.chain(
          Maybe.fold(
            () =>
              Future.fromIOEither(
                LogUtils.withGuild(
                  logger,
                  'warn',
                  member.guild,
                )(`Couldn't send greeting DM to ${member.user.tag}`),
              ),
            () => Future.unit,
          ),
        ),
      )
    },
  }
}
