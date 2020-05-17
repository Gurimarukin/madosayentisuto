import * as t from 'io-ts'

import { ConfReader } from '../../src/config/ConfReader'
import { Either } from '../../src/utils/fp'

describe('ConfReader.fromJsons', () => {
  it('should fail for non object', () => {
    const reader = ConfReader.fromJsons('fail')

    expect(reader(t.string)('foo')).toStrictEqual(Either.left(['key foo: missing key']))
  })

  it('should fail for missing path', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 123 } })

    expect(reader(t.number)('foo', 'baz')).toStrictEqual(Either.left(['key foo.baz: missing key']))
    expect(reader(t.number)('foo', 'bar', 'baz')).toStrictEqual(
      Either.left(['key foo.bar.baz: missing key'])
    )
  })

  it('should fail for invalid value', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 'toto' } })

    expect(reader(t.number)('foo')).toStrictEqual(
      Either.left(['key foo: expected number got {"bar":"toto"}'])
    )
    expect(reader(t.number)('foo', 'bar')).toStrictEqual(
      Either.left(['key foo.bar: expected number got "toto"'])
    )
  })

  it('should parse path', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 123 } })

    expect(reader(t.number)('foo', 'bar')).toStrictEqual(Either.right(123))
  })

  it('should merge configs', () => {
    const reader = ConfReader.fromJsons({ foo: 123 }, { bar: 'toto' })

    expect(reader(t.number)('foo')).toStrictEqual(Either.right(123))
    expect(reader(t.string)('bar')).toStrictEqual(Either.right('toto'))
  })

  it('should merge configs and take first valid value', () => {
    const reader = ConfReader.fromJsons(
      {
        foo: { bar: 123 },
        baz: { cde: 789 }
      },
      {
        foo: { bar: 456 },
        baz: { cde: 'toto' }
      }
    )

    expect(reader(t.number)('foo', 'bar')).toStrictEqual(Either.right(123))
    expect(reader(t.number)('baz', 'cde')).toStrictEqual(Either.right(789))
    expect(reader(t.string)('baz', 'cde')).toStrictEqual(
      Either.left(['key baz.cde: expected string got 789'])
    )
  })
})
