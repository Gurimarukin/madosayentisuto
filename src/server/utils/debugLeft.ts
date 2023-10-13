/* eslint-disable functional/no-expression-statements,
                  functional/no-this-expressions */
import { Future } from '../../shared/utils/fp'

// eslint-disable-next-line functional/no-classes
export class DebugError extends Error {
  public override stack = undefined

  constructor(
    functionName: string,
    public originalError: Error,
  ) {
    super()
    this.name = `DebugError - ${functionName}`
  }
}

export const debugLeft = <A>(functionName: string): ((f: Future<A>) => Future<A>) =>
  Future.mapLeft(e => new DebugError(functionName, e))
