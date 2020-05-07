import { Opts } from './Opts'

export interface CommandWithPrefix<A> {
  readonly prefix: string
  readonly opts: Opts<A>
}

export const CommandWithPrefix = <A>(prefix: string, opts: Opts<A>): CommandWithPrefix<A> => ({
  prefix,
  opts
})
