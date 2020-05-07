import { Either } from '../utils/fp'

export type Validated<A> = Either<string, A>
