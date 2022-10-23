import type { GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'

import type { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { TSubject } from '../../shared/models/rx/TSubject'
import { Future, IO, Maybe } from '../../shared/utils/fp'

import type {
  MadEventAudioChannelConnected,
  MadEventAudioChannelDisconnected,
  MadEventAudioChannelMoved,
  MadEventVoiceStateUpdate,
} from '../models/event/MadEvent'
import { MadEvent } from '../models/event/MadEvent'

type AudioChannelEvent =
  | MadEventAudioChannelConnected
  | MadEventAudioChannelMoved
  | MadEventAudioChannelDisconnected

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const VoiceStateUpdateTransformer = (
  clientId: DiscordUserId,
  subject: TSubject<AudioChannelEvent>,
) =>
  ObserverWithRefinement.fromNext(
    MadEvent,
    'VoiceStateUpdate',
  )(event =>
    pipe(
      getMember(event),
      Maybe.chain<GuildMember, AudioChannelEvent>(member => {
        const oldChan = event.oldState.channel
        const newChan = event.newState.channel

        if (oldChan === null && newChan !== null) {
          return Maybe.some(MadEvent.AudioChannelConnected(member, newChan))
        }

        if (oldChan !== null && newChan !== null && oldChan.id !== newChan.id) {
          return Maybe.some(MadEvent.AudioChannelMoved(member, oldChan, newChan))
        }

        if (oldChan !== null && newChan === null) {
          return Maybe.some(MadEvent.AudioChannelDisconnected(member, oldChan))
        }

        return Maybe.none
      }),
      Maybe.fold(() => IO.notUsed, subject.next),
      Future.fromIOEither,
    ),
  )

// ensures that we have the same id
const getMember = ({ oldState, newState }: MadEventVoiceStateUpdate): Maybe<GuildMember> =>
  pipe(
    Maybe.fromNullable(oldState.member),
    Maybe.chain(memberOld =>
      pipe(
        Maybe.fromNullable(newState.member),
        Maybe.filter(memberNew => memberNew.id === memberOld.id),
      ),
    ),
  )
