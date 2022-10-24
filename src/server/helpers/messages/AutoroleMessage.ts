import type { BaseMessageOptions, Message, Role } from 'discord.js'
import { ButtonStyle } from 'discord.js'

import { Maybe } from '../../../shared/utils/fp'

import { MessageComponent } from '../../models/discord/MessageComponent'
import { customIdCodec } from '../../utils/ioTsUtils'

const ButtonIds = {
  add: customIdCodec('autoroleAddButton'),
  remove: customIdCodec('autoroleRemoveButton'),
}

export type AutoroleMessageArgs = {
  readonly role: Role
  readonly descriptionMessage: string
  readonly addButton: string
  readonly removeButton: string
  readonly addButtonEmoji: Maybe<string>
  readonly removeButtonEmoji: Maybe<string>
}

const of = ({
  role,
  descriptionMessage,
  addButtonEmoji,
  addButton,
  removeButtonEmoji,
  removeButton,
}: AutoroleMessageArgs): BaseMessageOptions => ({
  content: descriptionMessage,
  components: [
    MessageComponent.row([
      MessageComponent.buttonWithCustomId({
        custom_id: ButtonIds.add.encode(role.id),
        style: ButtonStyle.Primary,
        label: addButton,
        emoji: Maybe.toUndefined(addButtonEmoji),
      }),
      MessageComponent.buttonWithCustomId({
        custom_id: ButtonIds.remove.encode(role.id),
        style: ButtonStyle.Secondary,
        label: removeButton,
        emoji: Maybe.toUndefined(removeButtonEmoji),
      }),
    ]),
  ],
})

const fromMessage = (message: Message): BaseMessageOptions => ({
  content: message.content,
  components: message.components,
})

export const AutoroleMessage = { ButtonIds, of, fromMessage }
