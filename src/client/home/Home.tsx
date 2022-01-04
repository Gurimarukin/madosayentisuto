import React from 'react'

import { apiRoutes } from '../../shared/ApiRouter'
import { GuildDAO } from '../../shared/models/guild/GuildDAO'
import { List } from '../../shared/utils/fp'

import { useHttp } from '../hooks/useHttp'

const guildsDecoder = List.decoder(GuildDAO.codec)

export const Home = (): JSX.Element => {
  const { data: guilds, error } = useHttp('get', apiRoutes.api.guilds, {}, [
    guildsDecoder,
    'Guild[]',
  ])

  return (
    <>
      <h1>Jean Plank Bot</h1>
      <pre>
        {error !== undefined
          ? 'error'
          : guilds === undefined
          ? 'loading...'
          : JSON.stringify(guilds, null, 2)}
      </pre>
    </>
  )
}
