import type { IndexDirection, IndexDescription as MongoIndexDescription } from 'mongodb'

export type WithoutProjection<T> = T & {
  fields?: undefined
  projection?: undefined
}

export type IndexDescription<A> = Omit<MongoIndexDescription, 'key'> & {
  key: {
    [B in keyof A]?: IndexDirection
  }
}
