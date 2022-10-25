import type {
  APIApplicationCommandBasicOption,
  APIApplicationCommandBooleanOption,
  APIApplicationCommandChannelOption,
  APIApplicationCommandMentionableOption,
  APIApplicationCommandOption,
  APIApplicationCommandRoleOption,
  APIApplicationCommandStringOption,
  APIApplicationCommandSubcommandGroupOption,
  APIApplicationCommandSubcommandOption,
  ChannelType,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js'
import { ApplicationCommandOptionType, ApplicationCommandType } from 'discord.js'
import type { nonEmptyArray } from 'fp-ts'

import { List, NonEmptyArray } from '../../../shared/utils/fp'

type Command<
  A extends RESTPostAPIApplicationCommandsJSONBody = RESTPostAPIApplicationCommandsJSONBody,
> = GlobalCommand<A> | GuildCommand<A>

type GlobalCommand<
  A extends RESTPostAPIApplicationCommandsJSONBody = RESTPostAPIApplicationCommandsJSONBody,
> = {
  readonly _tag: 'Global'
  readonly value: A
}

type GuildCommand<
  A extends RESTPostAPIApplicationCommandsJSONBody = RESTPostAPIApplicationCommandsJSONBody,
> = {
  readonly _tag: 'Guild'
  readonly value: A
  readonly isAdmin: boolean
}

type CommandCommon = {
  readonly name: string
  readonly description: string
}

type CommandCommonGuild = CommandCommon & {
  readonly isAdmin?: boolean // default: false
}

type CommandCommandMessage = Omit<CommandCommon, 'description'>
type CommandCommonGuildMessage = Omit<CommandCommonGuild, 'description'>

type OptionCommon = {
  readonly name: string
  readonly description: string
  readonly required?: boolean
}

type OptionString = OptionCommon & {
  readonly choices?: List<Choice<string>>
}

type ChoiceType = string | number
type Choice<A extends ChoiceType> = {
  readonly name: string
  readonly value: A
}

type OptionChannel = OptionCommon & {
  readonly channel_types?: List<Exclude<ChannelType, ChannelType.DM | ChannelType.GroupDM>>
}

const global = <
  A extends RESTPostAPIApplicationCommandsJSONBody = RESTPostAPIApplicationCommandsJSONBody,
>(
  value: A,
): GlobalCommand<A> => ({ _tag: 'Global', value })

const guild = <
  A extends RESTPostAPIApplicationCommandsJSONBody = RESTPostAPIApplicationCommandsJSONBody,
>(
  value: A,
  isAdmin: boolean | undefined,
): GuildCommand<A> => ({ _tag: 'Guild', value, isAdmin: isAdmin ?? false })

const Command = {
  isGlobal: <A extends RESTPostAPIApplicationCommandsJSONBody>(
    cmd: Command<A>,
  ): cmd is GlobalCommand<A> => cmd._tag === 'Global',

  chatInputGlobal:
    (common: CommandCommon) =>
    (
      ...options: List<APIApplicationCommandOption>
    ): GlobalCommand<RESTPostAPIChatInputApplicationCommandsJSONBody> =>
      global(chatInput(common, options)),

  chatInputGuild:
    ({ isAdmin, ...common }: CommandCommonGuild) =>
    (
      ...options: List<APIApplicationCommandOption>
    ): GuildCommand<RESTPostAPIChatInputApplicationCommandsJSONBody> =>
      guild(chatInput(common, options), isAdmin),

  messageGlobal: (
    common: CommandCommandMessage,
  ): GlobalCommand<RESTPostAPIContextMenuApplicationCommandsJSONBody> => global(message(common)),

  messageGuild: ({
    isAdmin,
    ...common
  }: CommandCommonGuildMessage): GuildCommand<RESTPostAPIContextMenuApplicationCommandsJSONBody> =>
    guild(message(common), isAdmin),

  option: {
    subcommand:
      (common: OptionCommon) =>
      (
        ...options: List<APIApplicationCommandBasicOption>
      ): APIApplicationCommandSubcommandOption => ({
        type: ApplicationCommandOptionType.Subcommand,
        ...common,
        options: toMutable(options),
      }),
    subcommandGroup:
      (common: CommandCommon) =>
      (
        ...options: List<APIApplicationCommandSubcommandOption>
      ): APIApplicationCommandSubcommandGroupOption => ({
        type: ApplicationCommandOptionType.SubcommandGroup,
        ...common,
        options: toMutable(options),
      }),
    string: ({ choices, ...common }: OptionString): APIApplicationCommandStringOption => ({
      type: ApplicationCommandOptionType.String,
      ...common,
      choices: toMutable(choices),
    }),
    boolean: (common: OptionCommon): APIApplicationCommandBooleanOption => ({
      type: ApplicationCommandOptionType.Boolean,
      ...common,
    }),
    channel: ({ channel_types, ...common }: OptionChannel): APIApplicationCommandChannelOption => ({
      type: ApplicationCommandOptionType.Channel,
      ...common,
      channel_types: toMutable(channel_types),
    }),
    role: (common: OptionCommon): APIApplicationCommandRoleOption => ({
      type: ApplicationCommandOptionType.Role,
      ...common,
    }),
    mentionable: (common: OptionCommon): APIApplicationCommandMentionableOption => ({
      type: ApplicationCommandOptionType.Mentionable,
      ...common,
    }),
  },

  choice: <A extends ChoiceType>(name: string, value: A): Choice<A> => ({ name, value }),
}

export { Command, GlobalCommand, GuildCommand }

const chatInput = (
  common: CommandCommon,
  options: List<APIApplicationCommandOption>,
): RESTPostAPIChatInputApplicationCommandsJSONBody => ({
  type: ApplicationCommandType.ChatInput,
  ...common,
  options: toMutable(options),
})

const message = (
  common: CommandCommandMessage,
): RESTPostAPIContextMenuApplicationCommandsJSONBody => ({
  type: ApplicationCommandType.Message,
  ...common,
})

const toMutable = <A>(fa: List<A> | undefined): nonEmptyArray.NonEmptyArray<A> | undefined =>
  fa === undefined ? undefined : List.isNonEmpty(fa) ? NonEmptyArray.asMutable(fa) : undefined
