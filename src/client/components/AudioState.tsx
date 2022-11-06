import { pipe } from 'fp-ts/lib/function'
import React from 'react'

import { AudioStateValueView } from '../../shared/models/audio/AudioStateValueView'
import { AudioStateView } from '../../shared/models/audio/AudioStateView'
import { Track } from '../../shared/models/audio/music/Track'
import { GuildId } from '../../shared/models/guild/GuildId'
import { Maybe, NonEmptyArray } from '../../shared/utils/fp'

import { cssClasses } from '../utils/cssClasses'
import { ChannelViewComponent } from './ChannelViewComponent'

type Props = {
  guild: GuildId
  state: AudioStateView
}

export const AudioState = ({ guild, state }: Props): JSX.Element => {
  return (
    <ul className="flex list-disc flex-col ml-8 gap-2">
      <Li label="state" className="items-center gap-3">
        <span>{state.type}</span>
        {state.type === 'Disconnected' ? null : (
          <>
            <span>-</span>
            <ChannelViewComponent guild={guild} channel={state.channel} type="audio" />
          </>
        )}
      </Li>
      {state.type === 'Disconnected' ? null : <AudioStateValue value={state.value} />}
    </ul>
  )
}

type AudioStateValueProps = {
  value: AudioStateValueView
}

const AudioStateValue = ({ value }: AudioStateValueProps): JSX.Element => {
  switch (value.type) {
    case 'Music':
      return (
        <>
          <Li label="value" className="items-center gap-3">
            <span>{value.type}</span>
            {value.type === 'Music' ? (
              <>
                <span>-</span>
                <span>{value.isPaused ? '⏸️' : '▶️'}</span>
              </>
            ) : null}
          </Li>
          <Li label="currentTrack" className="flex-col gap-3">
            {pipe(
              value.currentTrack,
              Maybe.fold(
                () => null,
                track => <TrackComp track={track} />,
              ),
            )}
          </Li>
          <Li label="queue" className="flex-col gap-3">
            <ul>
              {value.queue.map(track => (
                <li>
                  <TrackComp track={track} />
                </li>
              ))}
            </ul>
          </Li>
        </>
      )

    case 'Elevator':
      return (
        <>
          <Li label="value" className="items-center gap-3">
            {value.type}
          </Li>
          <Li label="playlist" className="flex-col gap-2">
            <ul className="list-disc ml-8">
              {pipe(value.playlist, NonEmptyArray.unprepend, ([head, tail]) => (
                <>
                  <li className="flex items-center gap-2 ml-[-1rem]">
                    <span>▶️</span>
                    <span className="font-bold">{head}</span>
                  </li>
                  {tail.map(file => (
                    <li key={file}>{file}</li>
                  ))}
                </>
              ))}
            </ul>
          </Li>
        </>
      )
  }
}

type LiProps = {
  label: string
  className?: string
}

const Li: React.FC<LiProps> = ({ label, className, children }) => (
  <li>
    <div className={cssClasses('flex', className)}>
      <pre className="text-sm">{`${label}:`}</pre>
      {children}
    </div>
  </li>
)

type TrackProps = {
  track: Track
}

const TrackComp = ({ track }: TrackProps): JSX.Element => (
  <a
    href={track.url}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-4 w-[calc(100%_+_6rem)] pl-16 ml-[-4rem] py-3 hover:bg-gray2"
  >
    {pipe(
      track.thumbnail,
      Maybe.fold(
        () => null,
        src => (
          <img
            src={src}
            alt={`${track.title} thumbnail`}
            className="flex w-48 rounded-xl shadow-lg"
          />
        ),
      ),
    )}
    <p>{track.title}</p>
  </a>
)
