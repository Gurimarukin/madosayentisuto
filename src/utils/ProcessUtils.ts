import { spawn } from 'child_process'
import { Observable } from 'rxjs'

import { Future, Dict, Try, Either } from './fp'
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
    args: string[],
    options: ShortOptions = {}
  ): Future<CmdOutput> =>
    Future.apply(
      () =>
        new Promise<CmdOutput>(resolve => {
          let stdout = ''
          let stderr = ''

          execObservable(command, args, options).subscribe(
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

  export const execObservable = (
    command: string,
    args: string[],
    options: ShortOptions = {}
  ): ObservableE<CommandEvent> =>
    new Observable<Try<CommandEvent>>(subscriber => {
      const stream = spawn(command, args, { shell: true, cwd: options.cwd, env: options.env })

      stream.stdout.on('data', _ => subscriber.next(Try.right(CommandEvent.Stdout(_))))
      stream.stderr.on('data', _ => subscriber.next(Try.right(CommandEvent.Stderr(_))))

      stream.on('close', code => {
        subscriber.next(Try.right(CommandEvent.Done(code)))
        subscriber.complete()
      })
    })
}
