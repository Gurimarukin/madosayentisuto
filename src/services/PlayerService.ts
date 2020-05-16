import * as Obs from 'fp-ts-rxjs/lib/Observable'
import { TextChannel, VoiceChannel, Message, VoiceConnection, Guild } from 'discord.js'
import { failure } from 'io-ts/lib/PathReporter'
import { Subscription } from 'rxjs'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { CommandEvent } from '../models/CommandEvent'
import { GuildId } from '../models/GuildId'
import { ObservableE } from '../models/ObservableE'
import { TrackMetadata } from '../models/TrackMetadata'
import { PlayerAction } from '../store/player/PlayerAction'
import { PlayerReducer } from '../store/player/PlayerReducer'
import { Future, pipe, NonEmptyArray, Maybe, Either, IO, Try, flow, Dict, Do } from '../utils/fp'
import { LogUtils } from '../utils/LogUtils'
import { ProcessUtils } from '../utils/ProcessUtils'
import { StringUtils } from '../utils/StringUtils'

export type PlayerService = ReturnType<typeof PlayerService>

export function PlayerService(Logger: PartialLogger, discord: DiscordConnector) {
  const logger = Logger('PlayerService')

  const store = PlayerReducer.createStore({})

  const setLock = (guild: Guild, message: Message): IO<unknown> =>
    IO.apply(() => store.dispatch(PlayerAction.SetLock(GuildId.wrap(guild.id), message)))

  const deleteMessage = (guild: Guild): IO<unknown> =>
    IO.apply(() => store.dispatch(PlayerAction.DeleteMessage(GuildId.wrap(guild.id))))

  const setConnection = (guild: Guild, connection: VoiceConnection): IO<unknown> =>
    IO.apply(() => store.dispatch(PlayerAction.SetConnection(GuildId.wrap(guild.id), connection)))

  return {
    play: (
      voiceChannel: VoiceChannel,
      textChannel: TextChannel,
      tracks: NonEmptyArray<string>
    ): Future<unknown> =>
      pipe(
        discord.sendPrettyMessage(textChannel, 'Chargement...'),
        Future.chain(
          Maybe.fold<Message, Future<unknown>>(
            () =>
              Future.fromIOEither(
                LogUtils.withGuild(
                  logger,
                  'warn',
                  textChannel.guild
                )(`Can't send message to text channel: ${textChannel.name}`)
              ),
            loadingMessage =>
              pipe(
                setLock(voiceChannel.guild, loadingMessage),
                IO.chain(_ =>
                  pipe(
                    downloadInfos(tracks),
                    ObservableE.chain(
                      flow(
                        CommandEvent.fold({
                          onStdout: onTrackMetadataLoaded(voiceChannel, textChannel),
                          onStderr: _ =>
                            Future.fromIOEither(
                              LogUtils.withGuild(logger, 'error', voiceChannel.guild)(_)
                            ),
                          onDone: _ => Future.fromIOEither(logger.warn('TODO: remove lock'))
                        }),
                        ObservableE.fromTaskEither
                      )
                    ),
                    subscribe
                  )
                ),
                Future.fromIOEither
              )
          )
        )
      )
  }

  function subscribe<A>(obs: ObservableE<A>): IO<Subscription> {
    return IO.apply(() =>
      obs.subscribe(
        Either.fold<Error, unknown, void>(
          e => pipe(logger.error(e.stack), IO.runUnsafe),
          _ => {}
        )
      )
    )
  }

  function downloadInfos(
    urls: NonEmptyArray<string>
  ): ObservableE<CommandEvent<any, TrackMetadata>> {
    return pipe(
      ProcessUtils.execObservable('youtube-dl', [...ytDlCommonArgs, '--dump-json', ...urls]),
      Obs.map(
        Either.chain(
          CommandEvent.fold<any, any, Try<CommandEvent<any, TrackMetadata>>>({
            onStdout,
            onStderr: flow(CommandEvent.Stderr, Either.right),
            onDone: flow(CommandEvent.Done, Either.right)
          })
        )
      )
    )

    function onStdout(value: any): Try<CommandEvent<any, TrackMetadata>> {
      return pipe(
        Either.parseJSON(String(value), _ => Error('Invalid JSON from youtube-dl')),
        Either.chain(
          flow(
            TrackMetadata.codec.decode,
            Either.mapLeft(
              flow(failure, StringUtils.mkString('Errors while reading config:\n', '\n', ''), Error)
            )
          )
        ),
        Either.map(CommandEvent.Stdout)
      )
    }
  }

  function onTrackMetadataLoaded(
    voiceChannel: VoiceChannel,
    textChannel: TextChannel
  ): (metadata: TrackMetadata) => Future<void> {
    return metadata =>
      Do(Future.taskEither)
        .do(
          Future.fromIOEither(
            LogUtils.withGuild(logger, 'debug', voiceChannel.guild)('Downloaded', metadata)
          )
        )
        .bindL('output', () =>
          ProcessUtils.execAsync('youtube-dl', [
            ...ytDlCommonArgs,
            '--extract-audio',
            '--audio-format',
            'mp3',
            metadata.webpage_url
          ])
        )
        .doL(() => maybeDeleteLoadingMessage(voiceChannel.guild))
        .doL(({ output }) =>
          output.code === 0
            ? playFile(
                voiceChannel,
                textChannel,
                TrackMetadata.Lens.filename.modify(changeExtension('mp3'))(metadata)
              )
            : Future.fromIOEither(
                LogUtils.withGuild(
                  logger,
                  'error',
                  voiceChannel.guild
                )('Error while downloading file:\n', output.stderr)
              )
        )
        .return(() => {})
  }

  function maybeDeleteLoadingMessage(guild: Guild): Future<unknown> {
    return pipe(
      Dict.lookup(guild.id, store.getState()),
      Maybe.chain(_ => _.preload.message),
      Maybe.fold<Message, Future<unknown>>(
        () => Future.unit,
        flow(
          discordDeleteMessage,
          Future.chain(_ => Future.fromIOEither(deleteMessage(guild)))
        )
      )
    )
  }

  function discordDeleteMessage(message: Message): Future<void> {
    return pipe(
      discord.deleteMessage(message),
      Future.chain(deleted =>
        deleted
          ? Future.unit
          : Future.fromIOEither(
              LogUtils.withAuthor(
                logger,
                'info',
                message
              )('Not enough permissions to delete message')
            )
      )
    )
  }

  function playFile(
    voiceChannel: VoiceChannel,
    textChannel: TextChannel,
    metadata: TrackMetadata
  ): Future<unknown> {
    return pipe(
      Dict.lookup(voiceChannel.guild.id, store.getState()),
      Maybe.chain(_ => _.connection),
      Maybe.fold(
        () =>
          pipe(
            discord.joinVoiceChannel(voiceChannel),
            Future.chain(conn =>
              pipe(
                Future.fromIOEither(setConnection(voiceChannel.guild, conn)),
                Future.map(_ => conn)
              )
            )
          ),
        Future.right
      ),
      Future.map(res => {
        console.log('filename =', metadata._filename)
        return res
      }),
      Future.chain(_ => Future.fromIOEither(discord.connectionPlay(_, metadata._filename))),
      Future.chain(_ => discord.sendPrettyMessage(textChannel, `Playing **${metadata.title}**.`))
    )
  }
}

const fileExtension = /\.(\w)+$/
const changeExtension = (newExtension: string) => (fileName: string) =>
  fileName.replace(fileExtension, `.${newExtension}`)

const ytDlCommonArgs = ['--ignore-config', '--ignore-errors', '--no-call-home']

// '--extract-audio',
// '--audio-format',
// 'mp3',
// '--get-url',
// '--get-title',
// '--get-thumbnail',
// '--get-filename',

// okb play https://dbfiechter.bandcamp.com/album/tribal-jungle

// okb play https://www.youtube.com/watch?v=D8IjiKj-U5c

export namespace PlayerService {
  export const youtubeDlVersion = (): Future<string> =>
    pipe(
      ProcessUtils.execAsync('youtube-dl', ['--version']),
      Future.chain(o => (o.code === 0 ? Future.right(o.stdout) : Future.left(Error(o.stderr))))
    )
}
