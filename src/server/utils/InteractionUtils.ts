import type { ModalSubmitInteraction } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { List, Maybe } from '../../shared/utils/fp'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const validateModal = (interaction: ModalSubmitInteraction) => {
  const fields = interaction.fields.fields.toJSON()

  const getValueOpt = (customId: string): Maybe<Maybe<string>> =>
    pipe(
      fields,
      List.findFirstMap(c => {
        if (c.customId !== customId) return Maybe.none

        const trimed = c.value.trim()
        return Maybe.some(trimed === '' ? Maybe.none : Maybe.some(trimed))
      }),
    )

  return {
    getValueOpt,
    getValue: flow(getValueOpt, Maybe.flatten),
  }
}

export const InteractionUtils = { validateModal }
