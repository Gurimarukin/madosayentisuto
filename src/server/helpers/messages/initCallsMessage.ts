import type { APIRole, BaseMessageOptions, Role } from 'discord.js'
import { ButtonStyle } from 'discord.js'

import { StringUtils } from '../../../shared/utils/StringUtils'

import { constants } from '../../config/constants'
import { MessageComponent } from '../../models/discord/MessageComponent'
import type { GuildSendableChannel } from '../../utils/ChannelUtils'

export const initCallsButton = {
  subscribeId: 'callsSubscribe',
  unsubscribeId: 'callsUnsubscribe',
}

export const initCallsMessage = (
  channel: GuildSendableChannel,
  role: Role | APIRole,
): BaseMessageOptions => ({
  content: StringUtils.stripMargins(
    // TODO: remove disable
    /* eslint-disable @typescript-eslint/no-base-to-string */
    `Yoho, ${role} !
    |Tu peux t'abonner aux appels sur ce serveur en cliquant ci-dessous !
    |Ils seront notifiés dans le salon ${channel} (que tu devrais rendre muet).`,
  ), // ||Cliquer t'ajoute (ou t'enlève) le rôle ${role}||
  /* eslint-enable @typescript-eslint/no-base-to-string */
  components: [
    MessageComponent.row([
      MessageComponent.buttonWithCustomId({
        custom_id: initCallsButton.subscribeId,
        style: ButtonStyle.Primary,
        label: "S'abonner aux appels",
        emoji: constants.emojis.calls,
      }),
      MessageComponent.buttonWithCustomId({
        custom_id: initCallsButton.unsubscribeId,
        style: ButtonStyle.Secondary,
        label: ' ̶S̶e̶ ̶d̶é̶s̶a̶b̶o̶n̶n̶e̶r̶    Je suis une victime',
      }),
    ]),
  ],
})
