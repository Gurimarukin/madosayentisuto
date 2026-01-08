/* eslint-disable functional/no-expression-statements,
                  functional/no-throw-statements,
                  functional/no-try-statements */

//
// Copy pasta from https://github.com/vercel/ms/blob/3.0.0-canary.1/src/index.ts
//

// Helpers.
const s = 1000
const m = s * 60
const h = m * 60
const d = h * 24
const w = d * 7
const y = d * 365.25

type Unit =
  | 'Years'
  | 'Year'
  | 'Yrs'
  | 'Yr'
  | 'Y'
  | 'Weeks'
  | 'Week'
  | 'W'
  | 'Days'
  | 'Day'
  | 'D'
  | 'Hours'
  | 'Hour'
  | 'Hrs'
  | 'Hr'
  | 'H'
  | 'Minutes'
  | 'Minute'
  | 'Mins'
  | 'Min'
  | 'M'
  | 'Seconds'
  | 'Second'
  | 'Secs'
  | 'Sec'
  | 's'
  | 'Milliseconds'
  | 'Millisecond'
  | 'Msecs'
  | 'Msec'
  | 'Ms'

type UnitAnyCase = Unit | Uppercase<Unit> | Lowercase<Unit>

export type StringValue = `${number}` | `${number}${UnitAnyCase}` | `${number} ${UnitAnyCase}`

type Options = {
  /**
   * Set to `true` to use verbose formatting. Defaults to `false`.
   */
  long?: boolean
}

/**
 * Parse or format the given `val`.
 *
 * @param value - The string or number to convert
 * @param options - Options for the conversion
 * @throws Error if `value` is not a non-empty string or a number
 */
function ms(value: StringValue, options?: Options): number
function ms(value: number, options?: Options): string
function ms(value: StringValue | number, options?: Options): number | string {
  try {
    if (typeof value === 'string' && value.length > 0) {
      return parse(value)
    }
    if (typeof value === 'number' && isFinite(value)) {
      return options?.long === true ? fmtLong(value) : fmtShort(value)
    }
    throw new Error('Value is not a string or number.')
  } catch (error) {
    const message = isError(error)
      ? `${error.message}. value=${JSON.stringify(value)}`
      : 'An unknown error has occured.'
    throw new Error(message)
  }
}

export { ms }

/**
 * Parse the given `str` and return milliseconds.
 */
function parse(str: string): number {
  str = String(str)
  if (str.length > 100) {
    throw new Error('Value exceeds the maximum length of 100 characters.')
  }
  const match =
    // eslint-disable-next-line max-len
    /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
      str,
    )
  if (match === null) {
    return NaN
  }
  const n = parseFloat(match[1]!)
  const type = (match[2] ?? 'ms').toLowerCase() as Lowercase<Unit>
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y
    case 'weeks':
    case 'week':
    case 'w':
      return n * w
    case 'days':
    case 'day':
    case 'd':
      return n * d
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n
    default:
      // This should never occur.
      throw new Error(`The unit ${type as string} was matched, but no matching case exists.`)
  }
}

export default ms

/**
 * Short format for `ms`.
 */
function fmtShort(ms_: number): StringValue {
  const msAbs = Math.abs(ms_)
  if (msAbs >= d) {
    return `${Math.round(ms_ / d)}d`
  }
  if (msAbs >= h) {
    return `${Math.round(ms_ / h)}h`
  }
  if (msAbs >= m) {
    return `${Math.round(ms_ / m)}m`
  }
  if (msAbs >= s) {
    return `${Math.round(ms_ / s)}s`
  }
  return `${ms_}ms`
}

/**
 * Long format for `ms`.
 */
function fmtLong(ms_: number): StringValue {
  const msAbs = Math.abs(ms_)
  if (msAbs >= d) {
    return plural(ms_, msAbs, d, 'day')
  }
  if (msAbs >= h) {
    return plural(ms_, msAbs, h, 'hour')
  }
  if (msAbs >= m) {
    return plural(ms_, msAbs, m, 'minute')
  }
  if (msAbs >= s) {
    return plural(ms_, msAbs, s, 'second')
  }
  return `${ms_} ms`
}

/**
 * Pluralization helper.
 */
function plural(ms_: number, msAbs: number, n: number, name: string): StringValue {
  const isPlural = msAbs >= n * 1.5
  return `${Math.round(ms_ / n)} ${name}${isPlural ? 's' : ''}` as StringValue
}

/**
 * A type guard for errors.
 */
function isError(error: unknown): error is Error {
  return typeof error === 'object' && error !== null && 'message' in error
}
