import { spawn } from 'child_process'

import { Future, Dict } from './fp'

interface CmdOutput {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

export namespace ProcessUtils {
  export const exec = (
    command: string,
    args: string[],
    { cwd, env }: { cwd?: string; env?: Dict<string> } = {}
  ): Future<CmdOutput> => {
    return Future.apply(
      () =>
        new Promise<CmdOutput>(resolve => {
          const stream = spawn(command, args, { shell: true, cwd, env })

          let stdout = ''
          let stderr = ''

          stream.stdout.on('data', _ => (stdout += _))
          stream.stderr.on('data', _ => (stderr += _))
          stream.on('close', code => resolve({ code, stdout, stderr }))
        })
    )
  }
}
