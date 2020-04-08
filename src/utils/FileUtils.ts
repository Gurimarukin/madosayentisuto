import fs from 'fs'

export namespace FileUtils {
  export function readFileSync(path: string): IO<string> {
    return IO.apply(() => fs.readFileSync(path, 'utf8'))
  }
}
