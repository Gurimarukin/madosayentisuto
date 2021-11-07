import { SlashCommandBuilder } from '@discordjs/builders'
import { ChannelType } from 'discord-api-types'
import { pipe } from 'fp-ts/function'

import { InteractionCreate } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Future, todo } from '../../../utils/fp'

// ChannelType.GuildText |
// ChannelType.GuildVoice |
// ChannelType.GuildCategory |
// ChannelType.GuildNews |
// ChannelType.GuildStore |
// ChannelType.GuildNewsThread |
// ChannelType.GuildPublicThread |
// ChannelType.GuildPrivateThread |
// ChannelType.GuildStageVoice

const callsInitCommand = new SlashCommandBuilder()
  .setDefaultPermission(false)
  .setName('calls')
  .setDescription("Jean Plank n'est pas votre secrétaire mais gère vos appels.")
  .addSubcommand(subcommand =>
    /**
     * Jean Plank envoie un message dans le salon où la commande a été effectuée.
     * Les membres d'équipage qui y réagissent avec 🔔 obtiennent le rôle <role>.
     * À la suite de quoi, lorsqu'un appel commence sur le serveur, ils seront notifiés dans le salon <channel> en étant mentionné par le rôle <role>.`
     */
    subcommand
      .setName('init')
      .setDescription(`Pour initier la gestion des appels.`)
      .addChannelOption(option =>
        option
          .setName('channel')
          .addChannelTypes([ChannelType.GuildText])
          .setDescription('Le salon dans lequel les appels seront notifiés.')
          .setRequired(true),
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Le rôle qui sera notifié des appels.')
          .setRequired(true),
      ),
  )

export const adminCommands = [callsInitCommand]

export const AdminCommandsObserver = (): TObserver<InteractionCreate> => {
  return {
    next: event => {
      const interaction = event.interaction

      if (!interaction.isCommand()) return Future.unit

      if (interaction.commandName === callsInitCommand.name) return onCallsInit()

      return Future.unit
    },
  }

  function onCallsInit(): Future<void> {
    return pipe(todo())
    // return pipe(
    //             Future.sequenceArray<unknown>([
    //               deleteMessage(message),
    //               pipe(
    //                 fetchChannelAndRole(guild, command.channel, command.role),
    //                 Future.chain(
    //                   Either.fold(
    //                     flow(StringUtils.mkString('\n'), _ =>
    //                       discord.sendPrettyMessage(message.author, _),
    //                     ),
    //                     ([channel, role]) => callsInit(message, guild, channel, role),
    //                   ),
    //                 ),
    //               ),
    //             ]),
    //           )
  }
}

// CallsInit
// DefaultRoleGet
// DefaultRoleSet
// Say
// ActivityGet
// ActivityUnset
// ActivitySet
// ActivityRefresh
