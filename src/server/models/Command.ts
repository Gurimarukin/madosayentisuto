import type {
  APIApplicationCommandBasicOption,
  APIApplicationCommandBooleanOption,
  APIApplicationCommandChannelOption,
  APIApplicationCommandMentionableOption,
  APIApplicationCommandOption,
  APIApplicationCommandRoleOption,
  APIApplicationCommandStringOption,
  APIApplicationCommandSubcommandOption,
  ChannelType,
} from 'discord-api-types/payloads/v9'
import type {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord-api-types/rest/v9'
import type { nonEmptyArray } from 'fp-ts'

import { List } from '../../shared/utils/fp'
import { NonEmptyArray } from '../../shared/utils/fp'

type CommandCommon = {
  readonly name: string
  readonly description: string
  readonly default_permission?: boolean
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
      type: 1,
      ...common,
      options: toMutable(options),
    }),

  message: (
    common: Omit<CommandCommon, 'description'>,
  ): RESTPostAPIContextMenuApplicationCommandsJSONBody => ({ type: 3, ...common }),

  option: {
    subCommand:
      (common: OptionCommon) =>
      (
        ...options: List<APIApplicationCommandBasicOption>
      ): APIApplicationCommandSubcommandOption => ({
        type: 1,
        ...common,
        options: toMutable(options),
      }),
    string: ({ choices, ...common }: OptionString): APIApplicationCommandStringOption => ({
      type: 3,
      ...common,
      choices: toMutable(choices),
    }),
    boolean: (common: OptionCommon): APIApplicationCommandBooleanOption => ({ type: 5, ...common }),
    channel: ({ channel_types, ...common }: OptionChannel): APIApplicationCommandChannelOption => ({
      type: 7,
      ...common,
      channel_types: toMutable(channel_types),
    }),
    role: (common: OptionCommon): APIApplicationCommandRoleOption => ({ type: 8, ...common }),
    mentionable: (common: OptionCommon): APIApplicationCommandMentionableOption => ({
      type: 9,
      ...common,
    }),
  },

  choice: <A extends ChoiceType>(name: string, value: A): Choice<A> => ({ name, value }),
}

const toMutable = <A>(fa: List<A> | undefined): nonEmptyArray.NonEmptyArray<A> | undefined =>
  fa === undefined ? undefined : List.isNonEmpty(fa) ? NonEmptyArray.toMutable(fa) : undefined
