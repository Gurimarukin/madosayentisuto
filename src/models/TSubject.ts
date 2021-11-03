import { IO } from '../utils/fp'

export type TSubject<A> = /* Omit<Subject<A>, 'next'> & */ {
  readonly next: (value: A) => IO<void>
}
