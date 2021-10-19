// import { Functor2 } from 'fp-ts/Functor'
// import { pipeable } from 'fp-ts/pipeable'

// declare module 'fp-ts/lib/HKT' {
//   type URItoKind2<E, A> = {
//     readonly CommandEvent: CommandEvent<E, A>
//   };
// }

// const URI = 'CommandEvent'
// type URI = typeof URI

// export type CommandEvent<E, A> = CommandEvent.Stdout<A> | CommandEvent.Stderr<E> | CommandEvent.Done

// export namespace CommandEvent {
//   const commandEvent: Functor2<URI> = {
//     URI,
//     map: <E, A, B>(fa: CommandEvent<E, A>, f: (a: A) => B): CommandEvent<E, B> =>
//       isStdout(fa) ? Stdout(f(fa.value)) : fa,
//   }

//   export const { map } = pipeable(commandEvent)

//   export type Stdout<A> = {
//     readonly _tag: 'Stdout'
//     readonly value: A
//   };
//   export function Stdout<A>(value: A): Stdout<A> {
//     return { _tag: 'Stdout', value }
//   }

//   export function isStdout<E, A>(event: CommandEvent<E, A>): event is Stdout<A> {
//     return event._tag === 'Stdout'
//   }

//   export type Stderr<E> = {
//     readonly _tag: 'Stderr'
//     readonly value: E
//   };
//   export const Stderr = <E>(value: E): Stderr<E> => ({ _tag: 'Stderr', value })

//   export const isStderr = <E, A>(event: CommandEvent<E, A>): event is Stderr<E> =>
//     event._tag === 'Stderr'

//   export type Done = {
//     readonly _tag: 'Done'
//     readonly code: number
//   };
//   export const Done = (code: number): Done => ({ _tag: 'Done', code })

//   export const isDone = <E, A>(event: CommandEvent<E, A>): event is Done => event._tag === 'Done'

//   export const fold = <E, A, B>({ onStdout, onStderr, onDone }: FoldArgs<E, A, B>) => (
//     event: CommandEvent<E, A>,
//   ): B =>
//     isStdout(event)
//       ? onStdout(event.value)
//       : isStderr(event)
//       ? onStderr(event.value)
//       : onDone(event.code)
// }

// type FoldArgs<E, A, B> = {
//   readonly onStdout: (value: A) => B
//   readonly onStderr: (value: E) => B
//   readonly onDone: (code: number) => B
// };
