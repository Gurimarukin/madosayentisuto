import { pipe } from 'fp-ts/function'
import React from 'react'

import type { GuildId } from '../../shared/models/guild/GuildId'
import { UserId } from '../../shared/models/guild/UserId'
import { List, Maybe } from '../../shared/utils/fp'

import { BirthdayForm } from './BirthdayForm'
import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildMembers = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="members">
    {guild => (
      <div className="w-full">
        <ul className="grid grid-cols-[auto_auto_1fr]">
          <li className="contents text-lg font-bold">
            <span className="px-6 py-3 bg-gray2">Pseudal</span>
            <span className="flex items-center px-6 bg-gray2">Date de naissance</span>
            <span className="bg-gray2" />
          </li>
          {pipe(
            guild.members,
            List.map(member => (
              <li key={UserId.unwrap(member.id)} className="contents group">
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
                <div className="px-6 group-odd:bg-gray2">
                  <BirthdayForm initialBirthday={member.birthday} />
                </div>
                <span className="group-odd:bg-gray2" />
              </li>
            )),
          )}
        </ul>
      </div>
    )}
  </GuildLayout>
)
