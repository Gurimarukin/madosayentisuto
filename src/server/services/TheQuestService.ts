import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import type { Future } from '../../shared/utils/fp'
import { List, NonEmptyArray } from '../../shared/utils/fp'

import type { TheQuestConfig } from '../config/Config'
import type { HttpClient } from '../helpers/HttpClient'
import { TheQuestProgression } from '../models/theQuest/TheQuestProgression'

type TheQuestService = ReturnType<typeof TheQuestService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const TheQuestService = (config: TheQuestConfig, httpClient: HttpClient) => ({
  fetchForUsers: (users: NonEmptyArray<DiscordUserId>): Future<List<TheQuestProgression>> =>
    pipe(
      httpClient.http(
        [`${config.apiUrl}/madosayentisuto/users/getProgression`, 'post'],
        {
          headers: {
            Authorization: config.token,
          },
          json: [NonEmptyArray.encoder(DiscordUserId.codec), users],
        },
        [List.decoder(TheQuestProgression.decoder), 'List<TheQuestProgression>'],
      ),
    ),
})

export { TheQuestService }
