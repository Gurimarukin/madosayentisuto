import { Functor1 } from 'fp-ts/lib/Functor'
import { pipeable } from 'fp-ts/lib/pipeable'

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    readonly AddRemove: AddRemove<A>
  }
}

const URI = 'AddRemove'
type URI = typeof URI

export type AddRemove<A> = AddRemove.Add<A> | AddRemove.Remove<A>

export namespace AddRemove {
  export const addRemove: Functor1<URI> = {
    URI,
    map: <A, B>(fa: AddRemove<A>, f: (a: A) => B): AddRemove<B> => ({
      _tag: fa._tag,
      value: f(fa.value)
    })
  }

  export const { map } = pipeable(addRemove)

  export interface Add<A> {
    _tag: 'Add'
    value: A
  }
  export const Add = <A>(value: A): Add<A> => ({ _tag: 'Add', value })

  export const isAdd = <A>(fa: AddRemove<A>): fa is Add<A> => fa._tag === 'Add'

  export interface Remove<A> {
    _tag: 'Remove'
    value: A
  }
  export const Remove = <A>(value: A): Remove<A> => ({ _tag: 'Remove', value })

  export const isRemove = <A>(fa: AddRemove<A>): fa is Remove<A> => fa._tag === 'Remove'

  export const fold = <A, B>({ onAdd, onRemove }: FoldArgs<A, B>) => (fa: AddRemove<A>): B =>
    isAdd(fa) ? onAdd(fa.value) : onRemove(fa.value)
}

interface FoldArgs<A, B> {
  onAdd: (value: A) => B
  onRemove: (value: A) => B
}
