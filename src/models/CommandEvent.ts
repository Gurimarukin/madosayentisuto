export type CommandEvent = CommandEvent.Stdout | CommandEvent.Stderr | CommandEvent.Done

export namespace CommandEvent {
  export interface Stdout {
    readonly _tag: 'Stdout'
    readonly value: any
  }
  export const Stdout = (value: any): Stdout => ({ _tag: 'Stdout', value })

  export interface Stderr {
    readonly _tag: 'Stderr'
    readonly value: any
  }
  export const Stderr = (value: any): Stderr => ({ _tag: 'Stderr', value })

  export interface Done {
    readonly _tag: 'Done'
    readonly code: number
  }
  export const Done = (code: number): Done => ({ _tag: 'Done', code })

  export const fold = <A>({ onStdout, onStderr, onDone }: FoldArgs<A>) => (
    event: CommandEvent
  ): A => {
    switch (event._tag) {
      case 'Stdout':
        return onStdout(event.value)

      case 'Stderr':
        return onStderr(event.value)

      case 'Done':
        return onDone(event.code)
    }
  }
}

interface FoldArgs<A> {
  readonly onStdout: (value: any) => A
  readonly onStderr: (value: any) => A
  readonly onDone: (code: number) => A
}
