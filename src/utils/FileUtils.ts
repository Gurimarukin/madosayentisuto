import fs from 'fs'

import { io } from './IOUtils'

export namespace FileUtils {
  export function readFileSync(path: string): IO<string> {
    return io(() => fs.readFileSync(path, 'utf8'))
  }
}
