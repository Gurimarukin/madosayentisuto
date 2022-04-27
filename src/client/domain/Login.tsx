/* eslint-disable functional/no-expression-statement */
import React, { useCallback, useState } from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { ClearPassword } from '../../shared/models/webUser/ClearPassword'
import { LoginPayload } from '../../shared/models/webUser/LoginPayload'
import { UserName } from '../../shared/models/webUser/UserName'

import { useHistory } from '../contexts/HistoryContext'
import { useHttp } from '../contexts/HttpContext'
import { appRoutes } from '../router/AppRouter'

export const Login = (): JSX.Element => {
  const { navigate } = useHistory()
  const { http } = useHttp()

  const postLogin = useCallback(
    (userName: string, password: string): Promise<unknown> =>
      http(apiRoutes.login.post, {
        redirectToLoginOnUnauthorized: false,
        json: [
          LoginPayload.codec,
          {
            userName: UserName.wrap(userName),
            password: ClearPassword.wrap(password),
          },
        ],
      }),
    [http],
  )

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
    [navigate, password, postLogin, userName],
  )

  return (
    <div className="flex flex-col justify-center items-center h-full">
      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-[auto_auto] gap-3 justify-center items-center"
      >
        <label className="contents">
          <span>Nom d'utilisateur :</span>
          <input
            type="text"
            value={userName}
            onChange={handleUserNameChange}
            autoFocus={true}
            className="text-center text-inherit bg-gray1 rounded-sm border-none"
          />
        </label>
        <label className="contents">
          <span>Mot de passe :</span>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            className="text-center text-inherit bg-gray1 rounded-sm border-none"
          />
        </label>
        <button
          type="submit"
          className="col-span-2 justify-self-center py-1 px-4 bg-gray2 rounded-sm border border-gray1"
        >
          Connexion
        </button>
      </form>
    </div>
  )
}
