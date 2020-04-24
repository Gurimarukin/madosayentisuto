export namespace StringUtils {
  export const stripMargins = (str: string): string => str.replace(margin, '')
}

const margin = /^\s*\|/gm
