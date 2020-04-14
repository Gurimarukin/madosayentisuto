import fs from 'fs'

import { IO } from './fp'

export namespace FileUtils {
  export function readFileSync(path: string): IO<string> {
    return IO.apply(() => fs.readFileSync(path, 'utf8'))
  }
}
