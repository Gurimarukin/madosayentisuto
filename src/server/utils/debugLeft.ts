import { Future } from '../../shared/utils/fp'

/* eslint-disable functional/no-expression-statement,
                  functional/no-this-expression */
// eslint-disable-next-line functional/no-class
export class DebugError extends Error {
  public readonly stack = undefined

  constructor(functionName: string, public readonly originalError: Error) {
    super()
    this.name = `DebugError - ${functionName}`
  }
}
/* eslint-enable functional/no-expression-statement,
                  functional/no-this-expression */

export const debugLeft = <A>(functionName: string): ((f: Future<A>) => Future<A>) =>
  Future.mapLeft(e => new DebugError(functionName, e))
