import type { APIInteractionDataResolvedChannel, APIRole } from 'discord-api-types/v9'
import type { GuildChannel, MessageOptions, Role, ThreadChannel } from 'discord.js'
import { MessageActionRow, MessageButton } from 'discord.js'

import { constants } from '../constants'
import { StringUtils } from '../utils/StringUtils'

export const callsButton = {
  subscribeId: 'callsSubscribe',
  unsubscribeId: 'callsUnsubscribe',
}

export const getInitCallsMessage = (
  channel: ThreadChannel | APIInteractionDataResolvedChannel | GuildChannel,
  role: Role | APIRole,
): MessageOptions => ({
  content: StringUtils.stripMargins(
    `Yoho, ${role} !
    |Tu peux t'abonner aux appels sur ce serveur en cliquant ci-dessous !
    |Ils seront notifiés dans le salon ${channel} (que tu devrais rendre muet).`,
  ), // ||Cliquer t'ajoute (ou t'enlève) le rôle ${role}||
  components: [
    new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(callsButton.subscribeId)
        .setLabel("S'abonner aux appels")
        .setStyle('PRIMARY')
        .setEmoji(constants.emojis.calls),
      new MessageButton()
        .setCustomId(callsButton.unsubscribeId)
        .setLabel(' ̶S̶e̶ ̶d̶é̶s̶a̶b̶o̶n̶n̶e̶r̶    Je suis une victime')
        .setStyle('SECONDARY'),
    ),
  ],
})
