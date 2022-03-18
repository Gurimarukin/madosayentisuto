/* eslint-disable functional/no-expression-statement */
import { pipe } from 'fp-ts/function'
import React, { useCallback, useState } from 'react'

import { MsDuration } from '../../shared/models/MsDuration'
import { StringUtils } from '../../shared/utils/StringUtils'
import { Future, Maybe } from '../../shared/utils/fp'

import { Cancel, Check, EditPencil } from '../components/svgs'

type Props = {
  readonly initialBirthday: Maybe<Date>
}

export const BirthdayForm = ({ initialBirthday: birthday }: Props): JSX.Element => {
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
          birthday,
          Maybe.fold(() => '', StringUtils.formatDate),
        ),
      )
    },
    [birthday],
  )

  const stopEditing = useCallback(() => setIsEditing(false), [])
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setError(Maybe.none)
  }, [])
  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      console.log('handleFormSubmit')
      pipe(
        validateDate(value),
        Maybe.fold(
          () => setError(Maybe.some('Date invalide')),
          d => {
            setError(Maybe.none)
            setIsLoading(true)

            // TODO: api call
            Promise.resolve(d)
              .then(() => pipe(Future.unit, Future.delay(MsDuration.seconds(3)))())
              .then(() => {
                // TODO: mutate state
              })
              .catch(() => setError(Maybe.some("Erreur lors de l'envoi")))
              .finally(() => {
                setIsEditing(false)
                setIsLoading(false)
              })
          },
        ),
      )
    },
    [value],
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
            birthday,
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
