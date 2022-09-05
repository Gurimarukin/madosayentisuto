/* eslint-disable functional/no-expression-statement, functional/no-return-void */
import { pipe } from 'fp-ts/function'
import React, { useCallback, useState } from 'react'

import { apiRoutes } from '../../../../shared/ApiRouter'
import { DayJs } from '../../../../shared/models/DayJs'
import type { DiscordUserId } from '../../../../shared/models/DiscordUserId'
import { Maybe } from '../../../../shared/utils/fp'
import { DayJsFromISOString } from '../../../../shared/utils/ioTsUtils'

import { Cancel, Check, EditPencil, Prohibition } from '../../../components/svgs'
import { useHttp } from '../../../contexts/HttpContext'

type Props = {
  readonly userId: DiscordUserId
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
  const { http } = useHttp()

  const postBirthdate = useCallback(
    (member: DiscordUserId, birthdate: DayJs): Promise<unknown> =>
      http(apiRoutes.member.birthdate.post(member), {
        json: [DayJsFromISOString.encoder, birthdate],
      }),
    [http],
  )

  const deleteBirthdate = useCallback(
    (member: DiscordUserId): Promise<unknown> => http(apiRoutes.member.birthdate.del3te(member)),
    [http],
  )

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
    [onPostBirthdate, postBirthdate, userId, value],
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
    [deleteBirthdate, onDeleteBirthdate, userId],
  )

  return (
    <form onSubmit={handleFormSubmit} className="flex h-full items-center justify-center gap-x-3">
      <div className="flex w-[12ch] justify-center">
        {isEditing ? (
          <input
            ref={onInputMount}
            type="text"
            value={value}
            onChange={handleInputChange}
            autoFocus={true}
            className="w-full rounded-sm border-none bg-gray1 pl-2 text-inherit"
          />
        ) : (
          <span className="w-full">
            {pipe(
              initialBirthdate,
              Maybe.fold(
                () => '-',
                d => pipe(d, DayJs.format(dateFormat)),
              ),
            )}
          </span>
        )}
      </div>
      <div className="flex w-16 justify-between gap-x-1">
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
          <>
            <button type="button" onClick={startEditing} className="text-xl">
              <EditPencil />
            </button>
            {Maybe.isSome(initialBirthdate) ? (
              <button type="button" onClick={handleRemoveBirthdate} className="text-xl">
                <Prohibition />
              </button>
            ) : null}
          </>
        )}
      </div>
      <span className="grow text-sm text-red-700">{Maybe.toNullable(error)}</span>
    </form>
  )
}

const onInputMount = (e: HTMLInputElement | null): void => e?.select()

const dateFormat = 'DD/MM/YYYY'
const validateDate = (value: string): Maybe<DayJs> => {
  const d = DayJs.of(value, dateFormat)
  return DayJs.isValid(d) ? Maybe.some(d) : Maybe.none
}
