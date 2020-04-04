import { PartialLogger } from './Logger'
import { Publishable, Subscribable, EventHandler } from '../models/pubSub'
import { Store, Reducer } from '../utils/Store'

export type EventBus<Evt> = Publishable<Evt> & Subscribable<Evt>

export const EventBus = <Evt>(
  Logger: PartialLogger,
  shortEvent: (e: Evt) => any
): EventBus<Evt> => {
  const logger = Logger('EventBus')

  const store = Store(handlersReducer<Evt>(), Dict.empty)

  function publishUnsafe(event: Evt): void {
    pipe(
      publish(event),
      Future.orElse(e => Future.fromIOEither(logger.error('error while dispatching event:', e))),
      Future.runUnsafe
    )
  }

  function publish(event: Evt): Future<void> {
    return Do(Future.taskEither)
      .bind('handlers', Future.fromIOEither(store.getState()))
      .bindL('_1', ({ handlers }) =>
        pipe(
          Object.values(handlers),
          List.map(handler => handler(event)),
          Future.parallel
        )
      )
      .bind('_2', Future.fromIOEither(logger.debug('dispatched event:', shortEvent(event))))
      .return(() => {})
  }

  function subscribe(key: string, handler: EventHandler<Evt>): IO<void> {
    return Do(IO.ioEither)
      .bind('_1', store.dispatch(Action.subscribe(key, handler)))
      .bind('_2', logger.debug(`handler subscribed: "${key}"`))
      .return(() => {})
  }

  function unsubscribe(key: string): IO<void> {
    return Do(IO.ioEither)
      .bind('_1', store.dispatch(Action.unsubscribe(key)))
      .bind('_2', logger.debug(`handler unsubscribed: "${key}"`))
      .return(() => {})
  }

  return { publish: publishUnsafe, subscribe, unsubscribe }
}

const handlersReducer = <Evt>(): Reducer<Dict<EventHandler<Evt>>, Action<Evt>> => (
  handlers,
  action
) => {
  switch (action.type) {
    case 'subscribe':
      return pipe(handlers, Dict.insertAt(action.key, action.handler))

    case 'unsubscribe':
      return pipe(handlers, Dict.deleteAt(action.key))
  }
}

type Action<Evt> =
  | { type: 'subscribe'; key: string; handler: EventHandler<Evt> }
  | { type: 'unsubscribe'; key: string }

namespace Action {
  export const subscribe = <Evt>(key: string, handler: EventHandler<Evt>): Action<Evt> => ({
    type: 'subscribe',
    key,
    handler
  })

  export const unsubscribe = <Evt>(key: string): Action<Evt> => ({
    type: 'unsubscribe',
    key
  })
}
