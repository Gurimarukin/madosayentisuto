// import { spawn } from 'child_process'

// import { flow, pipe } from 'fp-ts/function'
// import { Observable } from 'rxjs'

// import { ObservableE } from '../models/ObservableE'
// import { Dict, Either, Future, List, Maybe, NonEmptyArray, Try } from './fp'

// export type CmdOutput = {
//   readonly code: number
//   readonly stdout: string
//   readonly stderr: string
// }

// export type ShortOptions = {
//   readonly cwd?: string
//   readonly env?: Dict<string, string>
// }

// const execAsync = (
//   command: string,
//   args: List<string> = [],
//   options: ShortOptions = {},
// ): Future<CmdOutput> =>
//   Future.apply(
//     () =>
//       new Promise<CmdOutput>(resolve => {
//         let stdout = ''
//         let stderr = ''

//         rawObservable(command, args, options).subscribe(
//           Either.map(
//             CommandEvent.fold({
//               onStdout: _ => {
//                 stdout += _
//               },
//               onStderr: _ => {
//                 stderr += _
//               },
//               onDone: code => resolve({ code, stdout, stderr }),
//             }),
//           ),
//         )
//       }),
//   )

// // emits a CommandEvent for each outputed line (which rawObservable doesn't)
// // const execObservable = (
// //   command: string,
// //   args: List<string> = [],
// //   options: ShortOptions = {},
// // ): ObservableE<CommandEvent<any, any>> =>
// //   new Observable<Try<CommandEvent<any, any>>>(subscriber => {
// //     const acc = {
// //       stdout: '',
// //       stderr: '',
// //     }

// //     rawObservable(command, args, options).subscribe(
// //       Either.fold<Error, CommandEvent<any, any>, void>(
// //         flow(Either.left, subscriber.next),
// //         CommandEvent.fold({
// //           onStdout: onData('stdout'),
// //           onStderr: onData('stderr'),
// //           onDone: code => {
// //             pipe(code, next(CommandEvent.Done))
// //             subscriber.complete()
// //           },
// //         }),
// //       ),
// //     )
// //     function onData(key: keyof typeof acc): (value: any) => void {
// //       return value => {
// //         const [head, ...tail] = String(value).split('\n')
// //         pipe(
// //           NonEmptyArray.fromArray(tail),
// //           Maybe.fold(
// //             () => {
// //               // don't call next, as head isn't a new line
// //               acc[key] += head
// //             },
// //             tail => {
// //               // call next for head and accumulated value
// //               pipe(acc[key] + head, next(CommandEvent.Stdout))

// //               // call next on init of tail
// //               NonEmptyArray.init(tail).map(next(CommandEvent.Stdout))

// //               // accumulate last
// //               acc[key] = NonEmptyArray.last(tail)
// //             },
// //           ),
// //         )
// //       }
// //     }

// //     function next<A>(apply: (a: A) => CommandEvent<any, any>): (a: A) => void {
// //       return a => subscriber.next(Either.right(apply(a)))
// //     }
// //   })

// export const ProcessUtils = { execAsync }

// // function rawObservable(
// //   command: string,
// //   args: List<string> = [],
// //   options: ShortOptions = {},
// // ): ObservableE<CommandEvent<any, any>> {
// //   return new Observable<Try<CommandEvent<any, any>>>(subscriber => {
// //     const stream = spawn(command, args, { shell: true, cwd: options.cwd, env: options.env })

// //     stream.stdout.on('data', _ => subscriber.next(Either.right(CommandEvent.Stdout(_))))
// //     stream.stderr.on('data', _ => subscriber.next(Either.right(CommandEvent.Stderr(_))))

// //     stream.on('close', code => {
// //       subscriber.next(Either.right(CommandEvent.Done(code)))
// //       subscriber.complete()
// //     })
// //   })
// // }
