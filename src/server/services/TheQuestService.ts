import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { Future, List, NonEmptyArray } from '../../shared/utils/fp'

import type { TheQuestConfig } from '../config/Config'
import type { HttpClient } from '../helpers/HttpClient'
import { StaticData } from '../models/theQuest/StaticData'
import { TheQuestProgressionResult } from '../models/theQuest/TheQuestProgressionResult'
import type { TheQuestProgressionPersistence } from '../persistence/TheQuestProgressionPersistence'

type TheQuestService = ReturnType<typeof TheQuestService>

const TheQuestService = (
  config: TheQuestConfig,
  theQuestProgressionPersistence: TheQuestProgressionPersistence,
  httpClient: HttpClient,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const apiStaticData: Future<StaticData> = httpClient.http(
    [`${config.apiUrl}/madosayentisuto/staticData`, 'get'],
    { headers: { Authorization: config.token } },
    [StaticData.decoder, 'StaticData'],
  )

  return {
    api: {
      staticData: apiStaticData,

      usersGetProgression: (users: List<DiscordUserId>): Future<List<TheQuestProgressionResult>> =>
        !List.isNonEmpty(users)
          ? Future.successful([])
          : httpClient.http(
              [`${config.apiUrl}/madosayentisuto/users/getProgression`, 'post'],
              {
                headers: { Authorization: config.token },
                json: [NonEmptyArray.encoder(DiscordUserId.codec), users],
              },
              [List.decoder(TheQuestProgressionResult.decoder), 'List<TheQuestProgressionResult>'],
            ),
    },

    persistence: {
      listAllForIds: theQuestProgressionPersistence.listAllForIds,
      bulkUpsert: theQuestProgressionPersistence.bulkUpsert,
      removeForIds: theQuestProgressionPersistence.removeForIds,
    },
  }
}

export { TheQuestService }
