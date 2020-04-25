export namespace StringUtils {
  export const stripMargins = (str: string): string => str.replace(margin, '')

  export const splitWords = (str: string): string[] => str.trim().split(whiteSpace)
}

const margin = /^\s*\|/gm
const whiteSpace = /\s+/
