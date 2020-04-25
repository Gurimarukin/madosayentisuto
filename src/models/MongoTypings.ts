import { ObjectId } from 'mongodb'

/**
 * copy-pasta from @types/mongodb
 */

// We can use TypeScript Omit once minimum required TypeScript Version is above 3.5
type Omit<T, K> = Pick<T, Exclude<keyof T, K>>

// TypeScript Omit (Exclude to be specific) does not work for objects with an "any" indexed type
type EnhancedOmit<T, K> = string | number extends keyof T
  ? T // T has indexed type e.g. { _id: string; [k: string]: any; } or it is "any"
  : Omit<T, K>

type ExtractIdType<TSchema> = TSchema extends { _id: infer U } // user has defined a type for _id
  ? {} extends U
    ? Exclude<U, {}>
    : unknown extends U
    ? ObjectId
    : U
  : ObjectId // user has not defined _id on schema

// this makes _id optional
export type OptionalId<TSchema extends { _id?: any }> = ObjectId extends TSchema['_id'] // a Schema with ObjectId _id type or "any" or "indexed type" provided
  ? EnhancedOmit<TSchema, '_id'> & { _id?: ExtractIdType<TSchema> } // a Schema provided but _id type is not ObjectId
  : WithId<TSchema>

// this adds _id as a required property
export type WithId<TSchema> = EnhancedOmit<TSchema, '_id'> & { _id: ExtractIdType<TSchema> }
