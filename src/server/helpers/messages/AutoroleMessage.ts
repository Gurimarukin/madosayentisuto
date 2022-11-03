import type {
  ActionRow,
  BaseMessageOptions,
  ButtonComponent,
  Message,
  MessageActionRowComponent,
} from 'discord.js'
import { ButtonStyle, ComponentType } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'

import { Maybe, refinementFromPredicate } from '../../../shared/utils/fp'

import { RoleId } from '../../models/RoleId'
import { MessageComponent } from '../../models/discord/MessageComponent'
import { CustomId, TupleFromArrayStrict } from '../../utils/ioTsUtils'

const Ids = {
  Buttons: {
    add: pipe(CustomId.codec('autoroleAddButton'), C.compose(RoleId.codec)),
    remove: pipe(CustomId.codec('autoroleRemoveButton'), C.compose(RoleId.codec)),
  },
}

type AutoroleMessage = {
  readonly roleId: RoleId
  readonly descriptionMessage: string
  readonly addButton: string
  readonly removeButton: string
  readonly addButtonEmoji: Maybe<string>
  readonly removeButtonEmoji: Maybe<string>
}

const of = ({
  roleId,
  descriptionMessage,
  addButtonEmoji,
  addButton,
  removeButtonEmoji,
  removeButton,
}: AutoroleMessage): BaseMessageOptions => ({
  content: descriptionMessage,
  components: [
    MessageComponent.row([
      MessageComponent.buttonWithCustomId({
        custom_id: Ids.Buttons.add.encode(roleId),
        style: ButtonStyle.Primary,
        label: addButton,
        emoji: Maybe.toUndefined(addButtonEmoji),
      }),
      MessageComponent.buttonWithCustomId({
        custom_id: Ids.Buttons.remove.encode(roleId),
        style: ButtonStyle.Secondary,
        label: removeButton,
        emoji: Maybe.toUndefined(removeButtonEmoji),
      }),
    ]),
  ],
})

const optionsFromMessage = (message: Message): BaseMessageOptions => ({
  content: message.content,
  components: message.components,
})

/**
 * messageDecoder
 */

const maybeEmojiDecoder = pipe(
  Maybe.decoder(
    D.fromPartial({
      id: D.id<string>(),
      animated: D.id<boolean>(),
    }),
  ),
  D.map(
    Maybe.chain(e =>
      e.id === undefined ? Maybe.none : Maybe.some(`<${e.animated === true ? 'a' : ''}:_:${e.id}>`),
    ),
  ),
)

type RawButton = {
  readonly customId: RoleId
  readonly label: string
  readonly emoji: Maybe<string>
}

const buttonFromComponentDecoder = (
  customIdDecoder: Decoder<string, RoleId>,
): Decoder<MessageActionRowComponent, RawButton> =>
  pipe(
    D.id<MessageActionRowComponent>(),
    D.parse<MessageActionRowComponent, ButtonComponent>(c =>
      c.type === ComponentType.Button ? D.success(c) : D.failure(c, 'ButtonComponent'),
    ),
    D.compose(
      D.fromStruct({
        customId /* : string | null */: pipe(D.string, D.compose(customIdDecoder)),
        label /* : string | null */: D.string,
        emoji /* : APIMessageComponentEmoji | null */: maybeEmojiDecoder,
      }),
    ),
  )

const buttonsDecoder = pipe(
  TupleFromArrayStrict.decoder(
    buttonFromComponentDecoder(Ids.Buttons.add),
    buttonFromComponentDecoder(Ids.Buttons.remove),
  ),
  D.refine(
    refinementFromPredicate(a => RoleId.Eq.equals(a[0].customId, a[1].customId)),
    'same roleId for add and remove button',
  ),
)

const messageDecoder: Decoder<Message, AutoroleMessage> = pipe(
  D.id<Message>(),
  D.compose(
    D.fromStruct({
      content: D.id<string>(),
      components: TupleFromArrayStrict.decoder(
        pipe(
          D.id<ActionRow<MessageActionRowComponent>>(),
          D.compose(D.fromStruct({ components: buttonsDecoder })),
        ),
      ),
    }),
  ),
  D.map(
    (a): AutoroleMessage => ({
      roleId: a.components[0].components[0].customId,
      descriptionMessage: a.content,
      addButton: a.components[0].components[0].label,
      removeButton: a.components[0].components[1].label,
      addButtonEmoji: a.components[0].components[0].emoji,
      removeButtonEmoji: a.components[0].components[1].emoji,
    }),
  ),
)

const AutoroleMessage = { Ids, of, optionsFromMessage, messageDecoder }

export { AutoroleMessage }
