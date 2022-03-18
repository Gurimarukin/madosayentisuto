import { pipe } from 'fp-ts/function'
import React from 'react'

import { GuildEmojiId } from '../../shared/models/guild/GuildEmojiId'
import type { GuildId } from '../../shared/models/guild/GuildId'
import { Maybe } from '../../shared/utils/fp'

import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildEmojis = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="emojis">
    {guild => (
      <ul>
        {guild.emojis.map(emoji => (
          <li key={GuildEmojiId.unwrap(emoji.id)}>
            <img
              src={emoji.url}
              alt={pipe(
                emoji.name,
                Maybe.fold(
                  () => 'Emoji inconnu',
                  n => `Emoji ${n}`,
                ),
              )}
            />
            <span>
              {pipe(
                emoji.name,
                Maybe.getOrElse(() => emoji.url),
              )}
            </span>
          </li>
        ))}
      </ul>
    )}
  </GuildLayout>
)
