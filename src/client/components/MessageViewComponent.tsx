import React from 'react'

import type { MessageView } from '../../shared/models/MessageView'

type Props = {
  readonly message: MessageView
}

export const MessageViewComponent = ({ message }: Props): JSX.Element => (
  <a href={message.url} target="_blank" className="whitespace-pre-wrap" rel="noreferrer">
    {message.content}
  </a>
)
