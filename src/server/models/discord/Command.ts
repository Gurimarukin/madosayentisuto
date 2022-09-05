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
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js'
import { ApplicationCommandOptionType, ApplicationCommandType } from 'discord.js'
import type { nonEmptyArray } from 'fp-ts'

import { List } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'

type CommandCommon = {
  readonly name: string
  readonly description: string
}

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

export const Command = {
  chatInput:
    (common: CommandCommon) =>
    (
      ...options: List<APIApplicationCommandOption>
    ): RESTPostAPIChatInputApplicationCommandsJSONBody => ({
      type: ApplicationCommandType.ChatInput,
      ...common,
      options: toMutable(options),
    }),

  message: (
    common: Omit<CommandCommon, 'description'>,
  ): RESTPostAPIContextMenuApplicationCommandsJSONBody => ({
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

const toMutable = <A>(fa: List<A> | undefined): nonEmptyArray.NonEmptyArray<A> | undefined =>
  fa === undefined ? undefined : List.isNonEmpty(fa) ? NonEmptyArray.toMutable(fa) : undefined
