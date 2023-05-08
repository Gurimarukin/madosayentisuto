import type React from 'react'

import type { MessageView } from '../../shared/models/MessageView'

import { channelLabel } from './ChannelViewComponent'

type Props = {
  message: MessageView
}

export const MessageViewComponent: React.FC<Props> = ({ message }) => (
  <a href={message.url} target="_blank" className="whitespace-pre-wrap underline" rel="noreferrer">
    {message.content === '' ? (
      <>
        {channelLabel(message.channel)}   {'>'}   🗨️
      </>
    ) : (
      message.content
    )}
  </a>
)
