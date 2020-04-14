import { Observable } from 'rxjs'

export type ObservableE<A> = Observable<Try<A>>
