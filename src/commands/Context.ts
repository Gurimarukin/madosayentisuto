import { Command } from './Command'
import { Opts } from './Opts'
import { NonEmptyArray } from '../utils/fp'

export interface Context<A> {
  readonly prefix: string
  readonly parents: Command<A>[]
  readonly siblings: NonEmptyArray<Opts<A>>
}

export function Context<A>(
  prefix: string,
  parents: Command<A>[],
  siblings: NonEmptyArray<Opts<A>>
): Context<A> {
  return { prefix, parents, siblings }
}

export namespace Context {
  export const setParents = <A>(parents: Command<A>[]) => (context: Context<A>): Context<A> => ({
    ...context,
    parents
  })

  export const setSiblings = <A>(siblings: NonEmptyArray<Opts<A>>) => (
    context: Context<A>
  ): Context<A> => ({ ...context, siblings })
}
