import { pipe } from 'fp-ts/function'
import React from 'react'

import type { AudioStateValueView } from '../../shared/models/audio/AudioStateValueView'
import type { AudioStateView } from '../../shared/models/audio/AudioStateView'
import type { Track } from '../../shared/models/audio/music/Track'
import type { GuildId } from '../../shared/models/guild/GuildId'
import { Maybe, NonEmptyArray } from '../../shared/utils/fp'

import { cssClasses } from '../utils/cssClasses'
import { ChannelViewComponent } from './ChannelViewComponent'

type Props = {
  readonly guild: GuildId
  readonly state: AudioStateView
}

export const AudioState = ({ guild, state }: Props): JSX.Element => (
  <ul className="ml-8 flex list-disc flex-col gap-2">
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

type AudioStateValueProps = {
  readonly value: AudioStateValueView
}

const AudioStateValue = ({ value }: AudioStateValueProps): JSX.Element => {
  switch (value.type) {
    case 'Music':
      return (
        <>
          <Li label="value" className="items-center gap-3">
            <span>{value.type}</span>
            <span>-</span>
            <span>{value.isPaused ? '⏸️' : '▶️'}</span>
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
              {value.queue.map((track, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={i}>
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
            <ul className="ml-8 list-disc">
              {pipe(value.playlist, NonEmptyArray.unprepend, ([head, tail]) => (
                <>
                  <li className="ml-[-1rem] flex items-center gap-2">
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
  readonly label: string
  readonly className?: string
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
  readonly track: Track
}

const TrackComp = ({ track }: TrackProps): JSX.Element => (
  <a
    href={track.url}
    target="_blank"
    rel="noreferrer"
    className="ml-[-4rem] flex w-[calc(100%_+_6rem)] items-center gap-4 py-3 pl-16 hover:bg-gray2"
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
