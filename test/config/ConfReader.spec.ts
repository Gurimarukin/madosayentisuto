import * as t from 'io-ts'

import { ConfReader } from '../../src/config/ConfReader'

describe('ConfReader.fromJsons', () => {
  it('should fail for non object', () => {
    const reader = ConfReader.fromJsons('fail')

    expect(reader(t.string)('foo')).toEqual(Either.left(['key foo: expected string got undefined']))
  })

  it('should fail for missing path', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 123 } })

    expect(reader(t.number)('foo', 'baz')).toEqual(
      Either.left(['key foo.baz: expected number got undefined'])
    )
  })

  it('should parse path', () => {
    const reader = ConfReader.fromJsons({ foo: { bar: 123 } })

    expect(reader(t.number)('foo', 'bar')).toEqual(Either.right(123))
  })

  it('should merge configs', () => {
    const reader = ConfReader.fromJsons({ foo: 123 }, { bar: 'toto' })

    expect(reader(t.number)('foo')).toEqual(Either.right(123))
    expect(reader(t.string)('bar')).toEqual(Either.right('toto'))
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

    expect(reader(t.number)('foo', 'bar')).toEqual(Either.right(123))
    expect(reader(t.number)('baz', 'cde')).toEqual(Either.right(789))
    expect(reader(t.string)('baz', 'cde')).toEqual(Either.right('toto'))
  })
})
