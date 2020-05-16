import { spawn } from 'child_process'
import { Observable } from 'rxjs'

import { Future, Dict, Try, Either, pipe, flow, NonEmptyArray, Maybe } from './fp'
import { CommandEvent } from '../models/CommandEvent'
import { ObservableE } from '../models/ObservableE'

interface CmdOutput {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

interface ShortOptions {
  readonly cwd?: string
  readonly env?: Dict<string>
}

export namespace ProcessUtils {
  export const execAsync = (
    command: string,
    args: string[] = [],
    options: ShortOptions = {}
  ): Future<CmdOutput> =>
    Future.apply(
      () =>
        new Promise<CmdOutput>(resolve => {
          let stdout = ''
          let stderr = ''

          rawObservable(command, args, options).subscribe(
            Either.map(
              CommandEvent.fold({
                onStdout: _ => {
                  stdout += _
                },
                onStderr: _ => {
                  stderr += _
                },
                onDone: code => resolve({ code, stdout, stderr })
              })
            )
          )
        })
    )

  // emits a CommandEvent for each outputed line (which rawObservable doesn't)
  export const execObservable = (
    command: string,
    args: string[] = [],
    options: ShortOptions = {}
  ): ObservableE<CommandEvent<any, any>> =>
    new Observable<Try<CommandEvent<any, any>>>(subscriber => {
      const acc = {
        stdout: '',
        stderr: ''
      }

      rawObservable(command, args, options).subscribe(
        Either.fold<Error, CommandEvent<any, any>, void>(
          flow(Either.left, subscriber.next),
          CommandEvent.fold({
            onStdout: onData('stdout'),
            onStderr: onData('stderr'),
            onDone: code => {
              pipe(code, next(CommandEvent.Done))
              subscriber.complete()
            }
          })
        )
      )

      function onData(key: keyof typeof acc): (value: any) => void {
        return value => {
          const [head, ...tail] = String(value).split('\n')
          pipe(
            NonEmptyArray.fromArray(tail),
            Maybe.fold(
              () => {
                // don't call next, as head isn't a new line
                acc[key] += head
              },
              tail => {
                // call next for head and accumulated value
                pipe(acc[key] + head, next(CommandEvent.Stdout))

                // call next on init of tail
                NonEmptyArray.init(tail).map(next(CommandEvent.Stdout))

                // accumulate last
                acc[key] = NonEmptyArray.last(tail)
              }
            )
          )
        }
      }

      function next<A>(apply: (a: A) => CommandEvent<any, any>): (a: A) => void {
        return a => subscriber.next(Either.right(apply(a)))
      }
    })
}

const rawObservable = (
  command: string,
  args: string[] = [],
  options: ShortOptions = {}
): ObservableE<CommandEvent<any, any>> =>
  new Observable<Try<CommandEvent<any, any>>>(subscriber => {
    const stream = spawn(command, args, { shell: true, cwd: options.cwd, env: options.env })

    stream.stdout.on('data', _ => subscriber.next(Either.right(CommandEvent.Stdout(_))))
    stream.stderr.on('data', _ => subscriber.next(Either.right(CommandEvent.Stderr(_))))

    stream.on('close', code => {
      subscriber.next(Either.right(CommandEvent.Done(code)))
      subscriber.complete()
    })
  })
