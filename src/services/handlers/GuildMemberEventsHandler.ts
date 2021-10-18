import { Guild, GuildMember, MessageEmbed, PartialGuildMember, TextChannel } from 'discord.js'
import * as Ord from 'fp-ts/Ord'

import { AddRemove } from '../../models/AddRemove'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { Colors } from '../../utils/Colors'
import { Future, IO, List, Maybe, flow, pipe } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { StringUtils } from '../../utils/StringUtils'
import { DiscordConnector } from '../DiscordConnector'
import { GuildStateService } from '../GuildStateService'
import { PartialLogger } from '../Logger'
import { random } from 'fp-ts'

export const GuildMemberEventsHandler = (
  Logger: PartialLogger,
  guildStateService: GuildStateService,
  discord: DiscordConnector,
): ((event: AddRemove<GuildMember | PartialGuildMember>) => Future<unknown>) => {
  const logger = Logger('GuildMemberEventsHandler')

  return flow(
    AddRemove.map(discord.fetchPartial),
    AddRemove.fold({
      onAdd: Future.chain(onAdd),
      onRemove: Future.chain(onRemove),
    }),
  )

  function onAdd(member: GuildMember): Future<unknown> {
    return pipe(
      LogUtils.withGuild(logger, 'info', member.guild)(`${member.user.tag} joined the server`),
      Future.fromIOEither,
      // DM greeting message
      Future.chain(_ =>
        discord.sendMessage(
          member,
          StringUtils.stripMargins(
            `Ha ha !
            |Tu as rejoint le serveur **${member.guild.name}**, quelle erreur !
            |En guise de cadeau de bienvenue, découvre immédiatement l'histoire du véritable capitaine en cliquant sur ce lien plein de malice !
            |(C'est comme OSS 117 mais en moins bien.)`,
          ),
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
        ),
      ),
      // set default role
      Future.chain(_ => guildStateService.getDefaultRole(member.guild)),
      Future.chain(
        Maybe.fold(
          () => Future.unit,
          role =>
            pipe(
              discord.addRole(member, role),
              Future.chain(_ =>
                pipe(
                  _,
                  Maybe.fold(
                    () =>
                      LogUtils.withGuild(
                        logger,
                        'warn',
                        member.guild,
                      )(`Couldn't add user "${member.user.tag}" to role "${role.name}"`),
                    _ =>
                      LogUtils.withGuild(
                        logger,
                        'debug',
                        member.guild,
                      )(`Added user "${member.user.tag}" to role "${role.name}"`),
                  ),
                  Future.fromIOEither,
                ),
              ),
            ),
        ),
      ),
    )
  }

  function onRemove(member: GuildMember): Future<unknown> {
    return pipe(
      LogUtils.withGuild(logger, 'info', member.guild)(`${member.user.tag} left the server`),
      IO.chain(_ => randomLeaveMessage(member)),
      Future.fromIOEither,
      Future.chain(msg =>
        pipe(
          goodbyeChannel(member.guild),
          Maybe.fold<TextChannel, Future<unknown>>(
            () => Future.unit,
            chan => discord.sendPrettyMessage(chan, msg),
          ),
        ),
      ),
    )
  }
}

const ordChannel = Ord.contramap((_: TextChannel) => _.position)(Ord.ordNumber)

function goodbyeChannel(guild: Guild): Maybe<TextChannel> {
  return pipe(
    Maybe.fromNullable(guild.systemChannel),
    Maybe.alt(() =>
      pipe(
        guild.channels.cache.array(),
        List.filter(ChannelUtils.isText),
        List.sort(ordChannel),
        List.head,
      ),
    ),
  )
}

const leaveMessages: ReadonlyArray<(member: string) => string> = [
  _ => `${_} est parti parce qu'il en avait marre de vous.`,
  _ => `Gibier de potence, ${_} quitte le navire...`,
  _ => `La trahison de ${_} est comme le sel sur une plaie.`,
  _ => `${_} me tourne le dos et invite mon poignard.`,
  _ => `J'ai perdu ${_}, mais pas mon âme.`,
  _ => `Ne jamais faire confiance à ${_}.`,
  _ => `Je vais emmener ${_} aux quais-abattoirs...`,
]

function randomLeaveMessage(member: GuildMember): IO<string> {
  return pipe(
    random.randomInt(0, leaveMessages.length - 1),
    IO.rightIO,
    IO.map(_ => leaveMessages[_](`**${member.user.tag}**`)),
  )
}
