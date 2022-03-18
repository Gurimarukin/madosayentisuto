import { pipe } from 'fp-ts/function'
import React from 'react'

import type { GuildId } from '../../shared/models/guild/GuildId'
import { MemberId } from '../../shared/models/guild/MemberId'
import { List, Maybe } from '../../shared/utils/fp'

import { EditPencil } from '../components/svgs'
import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildMembers = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="members">
    {guild => (
      <ul className="grid grid-cols-[auto_auto_1fr]">
        <li className="contents text-lg font-bold">
          <span className="px-6 py-3 bg-gray2">Pseudal</span>
          <span className="flex items-center px-6 bg-gray2">Date de naissance</span>
          <span className="bg-gray2" />
        </li>
        {pipe(
          guild.members,
          List.map(member => (
            <li key={MemberId.unwrap(member.id)} className="contents group">
              <div className="flex items-center gap-x-4 px-6 py-3 group-odd:bg-gray2">
                {pipe(
                  member.avatar,
                  Maybe.fold(
                    () => null,
                    avatar => (
                      <div className="w-12 h-12 rounded-full overflow-hidden">
                        <img src={avatar} alt={`Avatar de ${member.name}`} />
                      </div>
                    ),
                  ),
                )}
                <span style={{ color: member.color }}>{member.name}</span>
              </div>
              <div className="flex justify-center items-center px-6 group-odd:bg-gray2">
                01/01/1980 <EditPencil />
              </div>
              <span className="group-odd:bg-gray2" />
            </li>
          )),
        )}
      </ul>
    )}
  </GuildLayout>
)
