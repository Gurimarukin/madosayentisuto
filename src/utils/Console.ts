import { io } from './IOUtils';

export namespace Console {
  export function log(...a: any[]): IO<void> {
    return io(() => console.log(...a))
  }

  export function info(...a: any[]): IO<void> {
    return io(() => console.info(...a))
  }

  export function warn(...a: any[]): IO<void> {
    return io(() => console.warn(...a))
  }

  export function error(...a: any[]): IO<void> {
    return io(() => console.error(...a))
  }
}
