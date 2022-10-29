import type {
  APIActionRowComponent,
  APIModalActionRowComponent,
  APIModalInteractionResponseCallbackData,
  APITextInputComponent,
} from 'discord.js'
import { ComponentType } from 'discord.js'
import { pipe } from 'fp-ts/function'

import type { NonEmptyArray } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'

// _tag don't exist at runtime (see cast below)

type Modal = APIModalInteractionResponseCallbackData & {
  readonly _tag: 'Modal'
}

type MyTextInput = APITextInputComponent & {
  readonly _tag: 'MyTextInput'
}

type Of = {
  readonly custom_id: string
  readonly title: string
}

const of =
  ({ custom_id, title }: Of) =>
  (components: NonEmptyArray<MyTextInput>): Modal => {
    const res: APIModalInteractionResponseCallbackData = {
      custom_id,
      title,
      components: pipe(components, List.takeLeft(5), List.map(rowComponent), List.asMutable),
    }
    return res as Modal
  }

const rowComponent = (
  textInput: MyTextInput,
): APIActionRowComponent<APIModalActionRowComponent> => ({
  type: ComponentType.ActionRow,
  components: [textInput],
})

const textInput = (args: Omit<APITextInputComponent, 'type'>): MyTextInput => {
  const res: APITextInputComponent = { type: ComponentType.TextInput, ...args }
  return res as MyTextInput
}

const Modal = { of, textInput }

export { Modal }
