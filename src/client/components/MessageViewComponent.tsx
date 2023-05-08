import type React from 'react'

import type { MessageView } from '../../shared/models/MessageView'

type Props = {
  message: MessageView
}

export const MessageViewComponent: React.FC<Props> = ({ message }) => (
  <a href={message.url} target="_blank" className="whitespace-pre-wrap" rel="noreferrer">
    {message.content}
  </a>
)
