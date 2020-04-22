import { Observable } from 'rxjs'

import { Try } from '../utils/fp'

export type ObservableE<A> = Observable<Try<A>>
