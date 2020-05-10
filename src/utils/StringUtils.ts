import util from 'util'

export namespace StringUtils {
  export const stripMargins = (str: string): string => str.replace(margin, '')

  export const splitWords = (str: string): string[] => str.trim().split(whiteSpace)

  export function mkString(sep: string): (list: any[]) => string
  export function mkString(start: string, sep: string, end: string): (list: any[]) => string
  export function mkString(
    startOrSep: string,
    sep?: string,
    end?: string
  ): (list: any[]) => string {
    return list => {
      const strings = list.map(util.format)
      return sep !== undefined && end !== undefined
        ? `${startOrSep}${strings.join(sep)}${end}`
        : strings.join(startOrSep)
    }
  }
}

const margin = /^\s*\|/gm
const whiteSpace = /\s+/
