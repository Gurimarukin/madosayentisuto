import { ord, string } from 'fp-ts'
import type { Ord } from 'fp-ts/Ord'
import type { Lazy } from 'fp-ts/function'
import { pipe } from 'fp-ts/function'
import { lens, optional } from 'monocle-ts'
import React, { useMemo } from 'react'
import type { KeyedMutator } from 'swr'

import { DayJs } from '../../../shared/models/DayJs'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { MemberView } from '../../../shared/models/guild/MemberView'
import { List, Maybe } from '../../../shared/utils/fp'

import { BirthdateForm } from './BirthdateForm'
import type { GuildViewResponse } from './GuildLayout'
import { GuildLayout } from './GuildLayout'

type Props = {
  readonly guildId: GuildId
}

export const GuildMembers = ({ guildId }: Props): JSX.Element => (
  <GuildLayout guildId={guildId} selected="members">
    {(guild, response) => <Members guild={guild} response={response} />}
  </GuildLayout>
)

type MembersProps = {
  readonly guild: GuildView
  readonly response: GuildViewResponse
}

const Members = ({ guild, response }: MembersProps): JSX.Element => {
  const members = useMemo(
    () =>
      pipe(
        guild.members,
        List.sortBy([byBirthday(pipe(DayJs.now(), DayJs.startOf('day'))), byName]),
      ),
    [guild.members],
  )

  return (
    <div className="w-full">
      <ul className="grid grid-cols-[auto_auto_1fr]">
        <li className="contents text-lg font-bold">
          <span className="px-6 py-3 bg-gray2">Pseudal</span>
          <span className="flex items-center px-6 bg-gray2">Date de naissance</span>
          <span className="bg-gray2" />
        </li>
        {pipe(
          members,
          List.map(member => (
            <li key={DiscordUserId.unwrap(member.id)} className="contents group">
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
                <BirthdateForm
                  userId={member.id}
                  initialBirthdate={member.birthdate}
                  onPostBirthdate={onPostBirthdate(response.mutate, member.id)}
                  onDeleteBirthdate={onDeleteBirthdate(response.mutate, member.id)}
                />
              </div>
              <span className="group-odd:bg-gray2" />
            </li>
          )),
        )}
      </ul>
    </div>
  )
}

const byBirthday = (now: DayJs): Ord<MemberView> =>
  pipe(
    Maybe.getOrd(ord.reverse(DayJs.Ord)),
    ord.reverse,
    ord.contramap(m =>
      pipe(
        m.birthdate,
        Maybe.map(d => {
          const birthdayThisYear = pipe(d, DayJs.year.set(DayJs.year.get(now)))
          return ord.lt(DayJs.Ord)(birthdayThisYear, now)
            ? pipe(
                DayJs.year,
                lens.modify(y => y + 1),
              )(birthdayThisYear)
            : birthdayThisYear
        }),
      ),
    ),
  )

const byName: Ord<MemberView> = pipe(
  string.Ord,
  ord.contramap(m => m.name.toLowerCase()),
)

const onPostBirthdate =
  (mutate: KeyedMutator<GuildView>, userId: DiscordUserId) => (birthdate: DayJs) =>
    setBirthdate(mutate, userId, Maybe.some(birthdate))

const onDeleteBirthdate = (mutate: KeyedMutator<GuildView>, userId: DiscordUserId) => () =>
  setBirthdate(mutate, userId, Maybe.none)

const setBirthdate = (
  mutate: KeyedMutator<GuildView>,
  userId: DiscordUserId,
  birthdate: Maybe<DayJs>,
): Promise<GuildView | undefined> =>
  mutate(
    ifDefined(() =>
      pipe(
        GuildView.Lens.member(userId),
        optional.modify(MemberView.Lens.birthdate.set(birthdate)),
      ),
    ),
    false,
  )

function ifDefined<A, B>(f: Lazy<(a: A) => B>): (a: A | undefined) => B | undefined {
  return a => (a === undefined ? undefined : f()(a))
}
