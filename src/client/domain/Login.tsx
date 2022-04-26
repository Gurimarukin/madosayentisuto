/* eslint-disable functional/no-expression-statement */
import React, { useCallback, useState } from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { ClearPassword } from '../../shared/models/webUser/ClearPassword'
import { LoginPayload } from '../../shared/models/webUser/LoginPayload'
import { UserName } from '../../shared/models/webUser/UserName'

import { useHistory } from '../contexts/HistoryContext'
import { appRoutes } from '../router/AppRouter'
import { http } from '../utils/http'

export const Login = (): JSX.Element => {
  const { navigate } = useHistory()

  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')

  const handleUserNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setUserName(e.target.value),
    [],
  )
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
    [],
  )

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      postLogin(userName, password).then(() => navigate(appRoutes.index))
    },
    [navigate, password, userName],
  )

  return (
    <div className="h-full flex flex-col justify-center items-center">
      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-[auto_auto] justify-center items-center gap-3"
      >
        <label className="contents">
          <span>Nom d'utilisateur :</span>
          <input
            type="text"
            value={userName}
            onChange={handleUserNameChange}
            autoFocus={true}
            className="border-none rounded-sm bg-gray1 text-inherit text-center"
          />
        </label>
        <label className="contents">
          <span>Mot de passe :</span>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            className="border-none rounded-sm bg-gray1 text-inherit text-center"
          />
        </label>
        <button
          type="submit"
          className="col-span-2 justify-self-center border border-gray1 rounded-sm px-4 py-1 bg-gray2"
        >
          Connexion
        </button>
      </form>
    </div>
  )
}

const postLogin = (userName: string, password: string): Promise<unknown> =>
  http(apiRoutes.login.post, {
    json: [
      LoginPayload.codec,
      {
        userName: UserName.wrap(userName),
        password: ClearPassword.wrap(password),
      },
    ],
  })
