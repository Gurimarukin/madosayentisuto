import type { APIInteractionDataResolvedChannel, APIRole } from 'discord-api-types/v9'
import type { GuildChannel, Role, ThreadChannel } from 'discord.js'
import { MessageActionRow, MessageButton } from 'discord.js'

import { StringUtils } from '../../../shared/utils/StringUtils'

import { constants } from '../../constants'
import type { MyMessageOptions } from '../DiscordConnector'

export const initCallsButton = {
  subscribeId: 'callsSubscribe',
  unsubscribeId: 'callsUnsubscribe',
}

export const initCallsMessage = (
  channel: ThreadChannel | APIInteractionDataResolvedChannel | GuildChannel,
  role: Role | APIRole,
): MyMessageOptions => ({
  content: StringUtils.stripMargins(
    `Yoho, ${role} !
    |Tu peux t'abonner aux appels sur ce serveur en cliquant ci-dessous !
    |Ils seront notifiés dans le salon ${channel} (que tu devrais rendre muet).`,
  ), // ||Cliquer t'ajoute (ou t'enlève) le rôle ${role}||
  components: [
    new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(initCallsButton.subscribeId)
        .setLabel("S'abonner aux appels")
        .setStyle('PRIMARY')
        .setEmoji(constants.emojis.calls),
      new MessageButton()
        .setCustomId(initCallsButton.unsubscribeId)
        .setLabel(' ̶S̶e̶ ̶d̶é̶s̶a̶b̶o̶n̶n̶e̶r̶    Je suis une victime')
        .setStyle('SECONDARY'),
    ),
  ],
})
