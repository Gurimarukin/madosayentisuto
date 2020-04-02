import fs from 'fs'

import { io } from './IOUtils'

export namespace FileUtils {
  export function readFileSync(file: string): IO<string> {
    return io(() => fs.readFileSync(file, 'utf8'))
  }
}
