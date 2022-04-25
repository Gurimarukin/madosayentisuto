import * as C from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/lib/Encoder'
import { ObjectId } from 'mongodb'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

export type TObjectId = Newtype<{ readonly TObjectId: unique symbol }, string>

const { wrap, unwrap } = iso<TObjectId>()

const fromObjectId = (id: ObjectId): TObjectId => wrap(id.toString())

const decoder: Decoder<unknown, TObjectId> = {
  decode: i => (i instanceof ObjectId ? D.success(fromObjectId(i)) : D.failure(i, 'TObjectId')),
}

const encoder: Encoder<ObjectId, TObjectId> = {
  encode: id => new ObjectId(unwrap(id)),
}

const codec: C.Codec<unknown, ObjectId, TObjectId> = C.make(decoder, encoder)

export const TObjectId = { unwrap, decoder, encoder, codec }
