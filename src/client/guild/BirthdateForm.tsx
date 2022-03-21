/* eslint-disable functional/no-expression-statement, functional/no-return-void */
import { pipe } from 'fp-ts/function'
import React, { useCallback, useState } from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { DayJs } from '../../shared/models/DayJs'
import type { UserId } from '../../shared/models/guild/UserId'
import { Maybe } from '../../shared/utils/fp'
import { DateFromISOString } from '../../shared/utils/ioTsUtils'

import { Cancel, Check, EditPencil, Prohibition } from '../components/svgs'
import { http } from '../utils/http'

type Props = {
  readonly userId: UserId
  readonly initialBirthdate: Maybe<DayJs>
  readonly onPostBirthdate: (birthdate: DayJs) => void
  readonly onDeleteBirthdate: () => void
}

export const BirthdateForm = ({
  userId,
  initialBirthdate,
  onPostBirthdate,
  onDeleteBirthdate,
}: Props): JSX.Element => {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<Maybe<string>>(Maybe.none)
  const [isLoading, setIsLoading] = useState(false)

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsEditing(true)
      setValue(
        pipe(
          initialBirthdate,
          Maybe.fold(() => '', DayJs.format(dateFormat)),
        ),
      )
    },
    [initialBirthdate],
  )
  const stopEditing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsEditing(false)
    setError(Maybe.none)
  }, [])
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setError(Maybe.none)
  }, [])
  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      pipe(
        validateDate(value),
        Maybe.fold(
          () => setError(Maybe.some('Date invalide')),
          birthdate => {
            setError(Maybe.none)
            setIsLoading(true)
            postBirthdate(userId, birthdate)
              .then(() => onPostBirthdate(birthdate))
              .catch(() => setError(Maybe.some("Erreur lors de l'envoi")))
              .finally(() => {
                setIsEditing(false)
                setIsLoading(false)
              })
          },
        ),
      )
    },
    [userId, onPostBirthdate, value],
  )
  const handleRemoveBirthdate = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setError(Maybe.none)
      setIsLoading(true)
      deleteBirthdate(userId)
        .then(() => onDeleteBirthdate())
        .catch(() => setError(Maybe.some("Erreur lors de l'envoi")))
        .finally(() => setIsLoading(false))
      onDeleteBirthdate()
    },
    [onDeleteBirthdate, userId],
  )

  return (
    <form onSubmit={handleFormSubmit} className="h-full flex justify-center items-center gap-x-3">
      <div className="w-[12ch] flex justify-center">
        {isEditing ? (
          <input
            ref={onInputMount}
            type="text"
            value={value}
            onChange={handleInputChange}
            autoFocus={true}
            className="w-full border-none rounded-sm bg-gray1 text-inherit text-center"
          />
        ) : (
          pipe(
            initialBirthdate,
            Maybe.fold(
              () => <span className="w-full text-center">-</span>,
              d => <span>{pipe(d, DayJs.format(dateFormat))}</span>,
            ),
          )
        )}
      </div>
      <div className="w-16 flex justify-between gap-x-1">
        {isLoading ? (
          <pre>loading...</pre>
        ) : isEditing ? (
          <>
            <button type="submit" className="text-3xl">
              <Check />
            </button>
            <button onClick={stopEditing} className="text-3xl">
              <Cancel />
            </button>
          </>
        ) : (
          <>
            <button onClick={startEditing} className="text-xl">
              <EditPencil />
            </button>
            {Maybe.isSome(initialBirthdate) ? (
              <button onClick={handleRemoveBirthdate} className="text-xl">
                <Prohibition />
              </button>
            ) : null}
          </>
        )}
      </div>
      <span className="grow text-red-700 text-sm">{Maybe.toNullable(error)}</span>
    </form>
  )
}

const onInputMount = (e: HTMLInputElement | null): void => e?.select()

const dateFormat = 'DD/MM/YYYY'
const validateDate = (value: string): Maybe<DayJs> => {
  const d = DayJs.of(value, dateFormat)
  return DayJs.isValid(d) ? Maybe.some(d) : Maybe.none
}

const postBirthdate = (member: UserId, birthdate: DayJs): Promise<unknown> =>
  http(apiRoutes.post.api.member.birthdate(member), {
    json: [DateFromISOString.encoder, birthdate],
  })

const deleteBirthdate = (member: UserId): Promise<unknown> =>
  http(apiRoutes.delete_.api.member.birthdate(member))
