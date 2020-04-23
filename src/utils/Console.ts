import { IO } from './fp'

export namespace Console {
  export const log = (...a: any[]): IO<void> => IO.apply(() => console.log(...a))
  export const info = (...a: any[]): IO<void> => IO.apply(() => console.info(...a))
  export const warn = (...a: any[]): IO<void> => IO.apply(() => console.warn(...a))
  export const error = (...a: any[]): IO<void> => IO.apply(() => console.error(...a))
}
