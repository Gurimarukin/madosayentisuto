import { Colors } from 'bot/constants'
import { DiscordConnector } from 'bot/helpers/DiscordConnector'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { GuildMemberAdd } from 'bot/models/MadEvent'
import type { TObserver } from 'bot/models/rx/TObserver'
import { LogUtils } from 'bot/utils/LogUtils'
import { StringUtils } from 'bot/utils/StringUtils'
import { MessageEmbed } from 'discord.js'
import { pipe } from 'fp-ts/function'
import { Future, Maybe } from 'shared/utils/fp'

export const SendWelcomeDMObserver = (Logger: LoggerGetter): TObserver<GuildMemberAdd> => {
  const logger = Logger('SendWelcomeDMObserver')

  return {
    next: event => {
      const { member } = event
      const log = LogUtils.pretty(logger, member.guild)

      return pipe(
        log('info', `${member.user.tag} joined the guild`),
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
              Future.fromIOEither(log('warn', `Couldn't send greeting DM to ${member.user.tag}`)),
            () => Future.unit,
          ),
        ),
      )
    },
  }
}
