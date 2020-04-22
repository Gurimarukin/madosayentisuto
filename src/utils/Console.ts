import { IO } from './fp'

export namespace Console {
  export function log(...a: any[]): IO<void> {
    return IO.apply(() => console.log(...a))
  }

  export function info(...a: any[]): IO<void> {
    return IO.apply(() => console.info(...a))
  }

  export function warn(...a: any[]): IO<void> {
    return IO.apply(() => console.warn(...a))
  }

  export function error(...a: any[]): IO<void> {
    return IO.apply(() => console.error(...a))
  }
}
