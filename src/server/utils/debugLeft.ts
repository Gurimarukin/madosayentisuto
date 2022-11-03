import { Future } from '../../shared/utils/fp'

// eslint-disable-next-line functional/no-class
export class DebugError extends Error {
  public readonly stack = undefined

  constructor(public readonly functionName: string, public readonly originalError: Error) {
    // eslint-disable-next-line functional/no-expression-statement
    super()
  }
}

export const debugLeft = <A>(functionName: string): ((f: Future<A>) => Future<A>) =>
  Future.mapLeft(e => new DebugError(functionName, e))
