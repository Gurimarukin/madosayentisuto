import { Command } from './Command'

export interface CommandWithPrefix<A> {
  readonly prefix: string
  readonly command: Command<A>
}

export const CommandWithPrefix = <A>(
  prefix: string,
  command: Command<A>
): CommandWithPrefix<A> => ({ prefix, command })
