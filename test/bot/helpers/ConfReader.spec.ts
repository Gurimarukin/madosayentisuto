import * as D from 'io-ts/Decoder'

import { Either } from 'shared/utils/fp'

import { ConfReader } from 'bot/helpers/ConfReader'

describe('ConfReader.fromJsons', () => {
  it('should fail for non object', () => {
    const reader = ConfReader.fromJsons('fail')

    expect(reader(D.string)('foo')).toStrictEqual(Either.left(['key foo: missing key']))
  })

  it('should fail for missing path', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 123 } })

    expect(reader(D.number)('foo', 'baz')).toStrictEqual(Either.left(['key foo.baz: missing key']))
    expect(reader(D.number)('foo', 'bar', 'baz')).toStrictEqual(
      Either.left(['key foo.bar.baz: missing key']),
    )
  })

  it('should fail for invalid value', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 'toto' } })

    expect(reader(D.number)('foo')).toStrictEqual(
      Either.left(['key foo: cannot decode {"bar":"toto"}, should be number']),
    )
    expect(reader(D.number)('foo', 'bar')).toStrictEqual(
      Either.left(['key foo.bar: cannot decode "toto", should be number']),
    )
  })

  it('should parse path', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 123 } })

    expect(reader(D.number)('foo', 'bar')).toStrictEqual(Either.right(123))
  })

  it('should merge configs', () => {
    const reader = ConfReader.fromJsons({ foo: 123 }, { bar: 'toto' })

    expect(reader(D.number)('foo')).toStrictEqual(Either.right(123))
    expect(reader(D.string)('bar')).toStrictEqual(Either.right('toto'))
  })

  it('should merge configs and take first valid value', () => {
    const reader = ConfReader.fromJsons(
      {
        foo: { bar: 123 },
        baz: { cde: 789 },
      },
      {
        foo: { bar: 456 },
        baz: { cde: 'toto' },
      },
    )

    expect(reader(D.number)('foo', 'bar')).toStrictEqual(Either.right(123))
    expect(reader(D.number)('baz', 'cde')).toStrictEqual(Either.right(789))
    expect(reader(D.string)('baz', 'cde')).toStrictEqual(
      Either.left(['key baz.cde: cannot decode 789, should be string']),
    )
  })
})
