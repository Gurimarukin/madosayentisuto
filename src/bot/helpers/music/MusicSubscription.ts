import type {
  AudioPlayer,
  AudioPlayerEvents,
  VoiceConnection,
  VoiceConnectionEvents,
} from '@discordjs/voice'
import { AudioPlayerStatus } from '@discordjs/voice'
import { VoiceConnectionStatus } from '@discordjs/voice'
import type {
  Guild,
  MessageButtonStyleResolvable,
  MessageOptions,
  MessagePayload,
  StageChannel,
  TextBasedChannels,
  VoiceChannel,
} from 'discord.js'
import { MessageAttachment } from 'discord.js'
import { MessageActionRow, MessageButton } from 'discord.js'
import { apply, refinement } from 'fp-ts'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import { flow, pipe } from 'fp-ts/function'

import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { List } from '../../../shared/utils/fp'
import { Future, IO, Maybe } from '../../../shared/utils/fp'

import { constants } from '../../constants'
import { Store } from '../../models/Store'
import type {
  MusicEventConnectionReady,
  MusicEventPlayerIdle,
} from '../../models/events/MusicEvent'
import { MusicEvent } from '../../models/events/MusicEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { MusicStateConnected } from '../../models/music/MusicState'
import { MusicState } from '../../models/music/MusicState'
import type { Track } from '../../models/music/Track'
import { PubSub } from '../../models/rx/PubSub'
import type { TObserver } from '../../models/rx/TObserver'
import type { TSubject } from '../../models/rx/TSubject'
import { MessageUtils } from '../../utils/MessageUtils'
import { PubSubUtils } from '../../utils/PubSubUtils'
import { StringUtils } from '../../utils/StringUtils'
import { DiscordConnector } from '../DiscordConnector'

const { or } = PubSubUtils

type MusicChannel = VoiceChannel | StageChannel
type MyMessageOptions = string | MessagePayload | MessageOptions

export type MusicSubscription = ReturnType<typeof MusicSubscription>

const musicButtons = {
  playPauseId: 'musicPlayPause',
  nextId: 'musicNext',
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const MusicSubscription = (Logger: LoggerGetter, guild: Guild) => {
  const logger = Logger(`MusicSubscription-${guild.name}`)

  const state = Store<MusicState>(MusicState.empty)

  return { playTrack, stringify }

  function playTrack(
    musicChannel: MusicChannel,
    stateChannel: TextBasedChannels,
    track: Track,
  ): Future<void> {
    if (musicChannel.guild.id !== guild.id) {
      return Future.error('Called playSong with a wrong guild')
    }

    return pipe(
      state.update(MusicState.queueTrack(track)),
      Future.fromIOEither,
      Future.chainFirst(refreshMessage),
      Future.chain(newState => {
        switch (newState.type) {
          case 'Disconnected':
            return connect(musicChannel, stateChannel)

          case 'Connecting':
          case 'Connected':
            return Future.unit
        }
      }),
    )
  }

  function connect(musicChannel: MusicChannel, stateChannel: TextBasedChannels): Future<void> {
    const { observable, subject } = PubSub<MusicEvent>()

    const sub = PubSubUtils.subscribe(logger, observable)
    const subscribe = apply.sequenceT(IO.ApplyPar)(
      sub(loggerObserver(), or(refinement.id())),
      sub(lifecycleObserver(), or(MusicEvent.is('ConnectionReady'), MusicEvent.is('PlayerIdle'))),
    )

    return pipe(
      DiscordConnector.sendMessage(stateChannel, messages.connecting),
      Future.chainIOEitherK(message => state.update(MusicState.setMessage(message))),
      Future.chainIOEitherK(() =>
        pipe(
          apply.sequenceS(IO.ApplyPar)({
            voiceConnection: joinVoiceChannel(subject, musicChannel),
            audioPlayer: createAudioPlayer(subject),
          }),
          IO.apFirst(subscribe),
          IO.chain(({ voiceConnection, audioPlayer }) =>
            state.update(MusicState.connecting(musicChannel, voiceConnection, audioPlayer)),
          ),
        ),
      ),
      Future.map(() => {}),
    )
  }

  function joinVoiceChannel(
    subject: TSubject<MusicEvent>,
    channel: MusicChannel,
  ): IO<VoiceConnection> {
    return pipe(
      DiscordConnector.voiceConnectionJoin(channel),
      IO.chainFirst(voiceConnection => {
        const connectionPub = PubSubUtils.publishOn<VoiceConnectionEvents, MusicEvent>(
          voiceConnection,
          subject.next,
        )
        return apply.sequenceT(IO.ApplyPar)(
          connectionPub('error', MusicEvent.ConnectionError),
          connectionPub(VoiceConnectionStatus.Signalling, MusicEvent.ConnectionSignalling),
          connectionPub(VoiceConnectionStatus.Connecting, MusicEvent.ConnectionConnecting),
          connectionPub(VoiceConnectionStatus.Ready, MusicEvent.ConnectionReady),
          connectionPub(VoiceConnectionStatus.Disconnected, MusicEvent.ConnectionDisconnected),
          connectionPub(VoiceConnectionStatus.Destroyed, MusicEvent.ConnectionDestroyed),
        )
      }),
    )
  }

  function createAudioPlayer(subject: TSubject<MusicEvent>): IO<AudioPlayer> {
    return pipe(
      DiscordConnector.audioPlayerCreate,
      IO.chainFirst(audioPlayer => {
        const playerPub = PubSubUtils.publishOn<AudioPlayerEvents, MusicEvent>(
          audioPlayer,
          subject.next,
        )
        return apply.sequenceT(IO.ApplyPar)(
          playerPub('error', MusicEvent.PlayerError),
          playerPub(AudioPlayerStatus.Idle, MusicEvent.PlayerIdle),
          playerPub(AudioPlayerStatus.Buffering, MusicEvent.PlayerBuffering),
          playerPub(AudioPlayerStatus.Paused, MusicEvent.PlayerPaused),
          playerPub(AudioPlayerStatus.Playing, MusicEvent.PlayerPlaying),
          playerPub(AudioPlayerStatus.AutoPaused, MusicEvent.PlayerAutoPaused),
        )
      }),
    )
  }

  function lifecycleObserver(): TObserver<MusicEventConnectionReady | MusicEventPlayerIdle> {
    return {
      next: event => {
        switch (event.type) {
          case 'ConnectionReady':
            return onConnectionReady()

          case 'PlayerIdle':
            return onPlayerIdle()
        }
      },
    }
  }

  function onConnectionReady(): Future<void> {
    return pipe(
      state.get,
      Future.fromIOEither,
      Future.chain(s => {
        switch (s.type) {
          case 'Disconnected':
          case 'Connected':
            return Future.fromIOEither(
              logger.warn(`Inconsistent state: onConnectionReady while state was ${s.type}`),
            )

          case 'Connecting':
            if (List.isEmpty(s.queue)) return disconnect(s)

            return pipe(
              IO.Do,
              IO.bind('subscription', () =>
                DiscordConnector.voiceConnectionSubscribe(s.voiceConnection, s.audioPlayer),
              ),
              IO.bind('connected', ({ subscription }) =>
                state.update(MusicState.connected(s.audioPlayer, s.voiceConnection, subscription)),
              ),
              Future.fromIOEither,
              Future.chain(({ subscription, connected }) =>
                pipe(
                  subscription,
                  Maybe.fold(
                    () => Future.fromIOEither(logger.error('Subscription failed')),
                    () => playFirstTrackFromQueue(connected),
                  ),
                ),
              ),
            )
        }
      }),
    )
  }

  function onPlayerIdle(): Future<void> {
    return pipe(
      state.get,
      Future.fromIOEither,
      Future.chain(s => {
        switch (s.type) {
          case 'Disconnected':
          case 'Connecting':
            return Future.fromIOEither(
              logger.warn(`Inconsistent state: onPlayerIdle while state was ${s.type}`),
            )

          case 'Connected':
            if (List.isEmpty(s.queue)) return disconnect(s)

            return playFirstTrackFromQueue(s)
        }
      }),
    )
  }

  function playFirstTrackFromQueue({ audioPlayer }: MusicStateConnected): Future<void> {
    return pipe(
      state.get,
      IO.map(({ queue }) => queue),
      Future.fromIOEither,
      Future.chain(
        List.matchLeft(
          () => Future.unit,
          (head, tail) =>
            pipe(
              state.update(MusicState.setQueue(tail)),
              Future.fromIOEither,
              Future.chain(() => playTrackNow(audioPlayer, head)),
            ),
        ),
      ),
    )
  }

  function playTrackNow(audioPlayer: AudioPlayer, track: Track): Future<void> {
    return pipe(
      DiscordConnector.audioPlayerPlayArbitrary(audioPlayer, track),
      Future.fromIOEither,
      Future.chain(() => updateState(MusicState.setPlaying(Maybe.some(track)))),
    )
  }

  function updateState(f: Endomorphism<MusicState>): Future<void> {
    return pipe(state.update(f), Future.fromIOEither, Future.chain(refreshMessage))
  }

  function refreshMessage({ message, playing, queue }: MusicState): Future<void> {
    return pipe(
      futureMaybe.fromOption(message),
      futureMaybe.chainFuture(message_ =>
        DiscordConnector.messageEdit(message_, messages.playing(playing, queue)),
      ),
      Future.map(() => {}),
    )
  }

  function disconnect(currentState: MusicState): Future<void> {
    return pipe(
      currentState.message,
      Maybe.fold(() => Future.right(true), DiscordConnector.messageDelete),
      Future.chainIOEitherK(() =>
        pipe(
          MusicState.getVoiceConnection(currentState),
          Maybe.fold(() => IO.unit, DiscordConnector.voiceConnectionDestroy),
        ),
      ),
      Future.chainIOEitherK(() => state.set(MusicState.empty)),
      Future.map(() => {}),
    )
  }

  function loggerObserver(): TObserver<MusicEvent> {
    return {
      next: flow(event => {
        switch (event.type) {
          case 'ConnectionError':
          case 'PlayerError':
            return logger.warn(event.type, event.error)

          case 'ConnectionSignalling':
          case 'ConnectionConnecting':
          case 'ConnectionReady':
          case 'ConnectionDisconnected':
          case 'ConnectionDestroyed':

          case 'PlayerIdle':
          case 'PlayerBuffering':
          case 'PlayerPaused':
          case 'PlayerPlaying':
          case 'PlayerAutoPaused':
            const { type, oldState, newState } = event
            return logger.debug(`✉️  ${type} ${oldState.status} > ${newState.status}`)
        }
      }, Future.fromIOEither),
    }
  }

  function stringify(): string {
    return `<MusicSubscription[${guild.name}]>`
  }
}

const messages = {
  connecting: MessageUtils.singleSafeEmbed({
    color: 'RANDOM',
    description: 'Chargement...',
  }),

  playing: (
    playing: Maybe<Track>,
    queue: List<Track>,
    // isPlaying: boolean,
  ): MyMessageOptions => {
    const attachment = pipe(
      playing,
      Maybe.chain(t => t.thumbnail),
      Maybe.getOrElse(
        () =>
          'https://cdn.discordapp.com/attachments/849299103362973777/914484866098282506/jp_perdu.png',
      ),
      url => new MessageAttachment(url),
    )
    console.log('attachment =', attachment)
    return {
      embeds: [
        // MessageUtils.safeEmbed({
        //   color: 'RANDOM',
        //   fields: [],
        //   image: pipe(
        //     playing,
        //     Maybe.chain(t => t.thumbnail),
        //     Maybe.getOrElse(
        //       () =>
        //         'https://cdn.discordapp.com/attachments/849299103362973777/914484866098282506/jp_perdu.png',
        //     ),
        //     i => MessageUtils.image(i, 120, 120),
        //   ),
        // }),
        MessageUtils.safeEmbed({
          color: 'RANDOM',
          // title: 'DJean Plank',
          thumbnail: MessageUtils.thumbnail('https://i.imgur.com/AfFp7pu.png', 120, 120),
          // pipe(
          //   playing,
          //   Maybe.chain(t => t.thumbnail),
          //   Maybe.getOrElse(
          //     () =>
          //       'https://cdn.discordapp.com/attachments/849299103362973777/914484866098282506/jp_perdu.png',
          //   ),
          //   MessageUtils.thumbnail,
          // ),
          // MessageUtils.thumbnail(
          //   // 'https://cdn.discordapp.com/attachments/849299103362973777/914515868791242752/unknown.png', // Photo de profil de Jean Plank
          //   // 'https://cdn.discordapp.com/attachments/636626556734930948/755886935796351106/jp-mefian.gif', // JP méfian
          //   // 'https://djfrenchy.com/wp-content/uploads/2015/04/dj-sexy-clubbing.jpg', // DJ
          //   'https://i.imgur.com/lBrj5I6.gif', // DJ Jean Plank vers la droite
          // ),
          fields: [
            MessageUtils.field(
              'Morceau en cours :',
              pipe(
                playing,
                Maybe.fold(
                  () => 'Aucun morceau en cours.',
                  t => maskedLink(t.title, t.url),
                ),
              ),
            ),
            MessageUtils.field(),
            MessageUtils.field(
              "File d'attente :",
              pipe(
                queue,
                List.match(
                  () => `Aucun morceau dans la file d'attente.\n("/play <url>" pour en ajouter)`,
                  flow(
                    List.map(t => `• ${maskedLink(t.title, t.url)}`),
                    StringUtils.mkString('\n'),
                  ),
                ),
              ),
            ),
          ],
          image: MessageUtils.image('https://i.imgur.com/lBrj5I6.gif'),
          // pipe(
          //   playing,
          //   Maybe.chain(t => t.thumbnail),
          //   Maybe.getOrElse(
          //     () =>
          //       'https://cdn.discordapp.com/attachments/849299103362973777/914484866098282506/jp_perdu.png',
          //   ),
          //   MessageUtils.image,
          // ),
          video: MessageUtils.video(
            'https://cdn.discordapp.com/attachments/849299103362973777/914484866098282506/jp_perdu.png',
          ),
          timestamp: new Date(),
        }),
      ],
      components: [
        new MessageActionRow().addComponents(
          // isPlaying ? pauseButton : playButton,
          nextButton,
        ),
      ],
      attachments: [attachment],
    }
  },
}

const button = (
  id: string,
  label: string,
  emoji: string,
  style: MessageButtonStyleResolvable = 'SECONDARY',
): MessageButton =>
  new MessageButton().setCustomId(id).setLabel(label).setStyle(style).setEmoji(emoji)

// const pauseButton = button(musicButtons.playPauseId, 'Pause', constants.emojis.pause)
// const playButton = button(musicButtons.playPauseId, 'Lecture', constants.emojis.play)
const nextButton = button(musicButtons.nextId, 'Suivant', constants.emojis.next)

const maskedLink = (text: string, url: string): string => `[${text}](${url})`

// const sequenceTPar = flow(
//   apply.sequenceT(IO.ApplyPar),
//   IO.map(() => {}),
// )
