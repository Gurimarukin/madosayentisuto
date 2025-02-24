/* eslint-disable functional/no-expression-statements */
import type React from 'react'
import { useCallback, useState } from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { ClearPassword } from '../../shared/models/webUser/ClearPassword'
import { LoginPayload } from '../../shared/models/webUser/LoginPayload'
import { UserName } from '../../shared/models/webUser/UserName'

import { useHistory } from '../contexts/HistoryContext'
import { useHttp } from '../contexts/HttpContext'
import { appRoutes } from '../router/AppRouter'

export const Login: React.FC = () => {
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
    <div className="flex h-full flex-col items-center justify-center">
      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-[auto_auto] items-center justify-center gap-3"
      >
        <label className="contents">
          <span className="col-start-1 row-start-1">Nom d'utilisateur :</span>
          <input
            type="text"
            value={userName}
            onChange={handleUserNameChange}
            autoFocus={true}
            className="col-start-2 row-start-1 rounded-sm border-none bg-gray1 text-center text-inherit"
          />
        </label>
        <label className="contents">
          <span className="col-start-1 row-start-2">Mot de passe :</span>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            className="col-start-2 row-start-2 rounded-sm border-none bg-gray1 text-center text-inherit"
          />
        </label>
        <button
          type="submit"
          className="col-span-2 row-start-3 justify-self-center rounded-sm border border-gray1 bg-gray2 px-4 py-1"
        >
          Connexion
        </button>
      </form>
    </div>
  )
}
