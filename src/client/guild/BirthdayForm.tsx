/* eslint-disable functional/no-expression-statement, functional/no-return-void */
import { pipe } from 'fp-ts/function'
import React, { useCallback, useState } from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import type { UserId } from '../../shared/models/guild/UserId'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Maybe } from '../../shared/utils/fp'
import { DateFromISOString } from '../../shared/utils/ioTsUtils'

import { Cancel, Check, EditPencil } from '../components/svgs'
import { http } from '../utils/http'

type Props = {
  readonly userId: UserId
  readonly initialBirthday: Maybe<Date>
  readonly updateBirthday: (birthday: Date) => void
}

export const BirthdayForm = ({ userId, initialBirthday, updateBirthday }: Props): JSX.Element => {
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
          initialBirthday,
          Maybe.fold(() => '', StringUtils.formatDate),
        ),
      )
    },
    [initialBirthday],
  )
  const stopEditing = useCallback(() => setIsEditing(false), [])
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setError(Maybe.none)
  }, [])
  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      pipe(
        validateDate(value),
        Maybe.fold(
          () => setError(Maybe.some('Date invalide')),
          birthday => {
            setError(Maybe.none)
            setIsLoading(true)
            postForm(userId, birthday)
              .then(() => updateBirthday(birthday))
              .catch(() => setError(Maybe.some("Erreur lors de l'envoi")))
              .finally(() => {
                setIsEditing(false)
                setIsLoading(false)
              })
          },
        ),
      )
    },
    [userId, updateBirthday, value],
  )

  return (
    <form onSubmit={handleFormSubmit} className="h-full flex justify-center items-center gap-x-3">
      <div className="w-[12ch] flex justify-center">
        {isEditing ? (
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            autoFocus={true}
            className="w-full border-none rounded-sm bg-gray1 text-inherit text-center"
          />
        ) : (
          pipe(
            initialBirthday,
            Maybe.fold(
              () => <span className="w-full text-center">-</span>,
              d => <span>{StringUtils.formatDate(d)}</span>,
            ),
          )
        )}
      </div>
      <div className="w-16 flex justify-center gap-x-1">
        {isLoading ? (
          <pre>loading...</pre>
        ) : isEditing ? (
          <>
            <button type="submit" className="text-3xl">
              <Check />
            </button>
            <button type="button" onClick={stopEditing} className="text-3xl">
              <Cancel />
            </button>
          </>
        ) : (
          <button onClick={startEditing} className="text-xl">
            <EditPencil />
          </button>
        )}
      </div>
      <span className="grow text-red-700 text-sm">{Maybe.toNullable(error)}</span>
    </form>
  )
}

const validateDate = (value: string): Maybe<Date> => {
  const d = new Date(value)
  return isNaN(Number(d)) ? Maybe.none : Maybe.some(d)
}

const postForm = (member: UserId, birthday: Date): Promise<unknown> =>
  http(apiRoutes.post.api.member.birthday(member), { json: [DateFromISOString.encoder, birthday] })
