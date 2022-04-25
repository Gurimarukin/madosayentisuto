import { pipe } from 'fp-ts/function'
import React from 'react'

import { GuildEmojiId } from '../../../shared/models/guild/GuildEmojiId'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import { Maybe } from '../../../shared/utils/fp'

import { Tooltip } from '../../components/Tooltip'
import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildEmojis = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="emojis">
    {guild => (
      <ul className="w-full flex flex-wrap justify-center p-6 gap-6">
        {guild.emojis.map(emoji => (
          <li key={GuildEmojiId.unwrap(emoji.id)}>
            <Tooltip
              title={pipe(
                emoji.name,
                Maybe.getOrElse(() => emoji.url),
              )}
            >
              <img
                src={emoji.url}
                alt={pipe(
                  emoji.name,
                  Maybe.fold(
                    () => 'Emoji inconnu',
                    n => `Emoji ${n}`,
                  ),
                )}
                className="w-28 h-28 object-contain border border-gray1"
              />
            </Tooltip>
          </li>
        ))}
      </ul>
    )}
  </GuildLayout>
)
