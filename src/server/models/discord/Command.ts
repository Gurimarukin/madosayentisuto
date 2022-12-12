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
  APIApplicationCommandUserOption,
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
> = {
  readonly isGlobal: boolean
  readonly value: A
}

type CommandCommon = {
  readonly name: string
  readonly description: string
  readonly isGlobal?: boolean // default: false
}

type CommandCommonMessage = Omit<CommandCommon, 'description'>

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

const of = <A extends RESTPostAPIApplicationCommandsJSONBody>(
  isGlobal: boolean,
  value: A,
): Command<A> => ({ isGlobal, value })

const Command = {
  chatInput:
    ({ isGlobal = false, ...common }: CommandCommon) =>
    (
      ...options: List<APIApplicationCommandOption>
    ): Command<RESTPostAPIChatInputApplicationCommandsJSONBody> =>
      of(isGlobal, {
        type: ApplicationCommandType.ChatInput,
        ...common,
        options: toMutable(options),
      }),

  message: ({
    isGlobal = false,
    ...common
  }: CommandCommonMessage): Command<RESTPostAPIContextMenuApplicationCommandsJSONBody> =>
    of(isGlobal, {
      type: ApplicationCommandType.Message,
      ...common,
    }),

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
    user: (common: OptionCommon): APIApplicationCommandUserOption => ({
      type: ApplicationCommandOptionType.User,
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

export { Command }

const toMutable = <A>(fa: List<A> | undefined): nonEmptyArray.NonEmptyArray<A> | undefined =>
  fa === undefined ? undefined : List.isNonEmpty(fa) ? NonEmptyArray.asMutable(fa) : undefined
