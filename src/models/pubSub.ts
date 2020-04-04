export interface Publishable<Evt> {
  publish: (event: Evt) => void
}

export type EventHandler<Evt> = (event: Evt) => Future<void>

export interface Subscribable<Evt> {
  subscribe: (name: string, handler: EventHandler<Evt>) => IO<void>
  unsubscribe: (name: string) => IO<void>
}
