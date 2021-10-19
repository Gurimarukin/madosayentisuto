import fs from 'fs'

import { IO } from './fp'

const readFileSync = (path: string): IO<string> => IO.tryCatch(() => fs.readFileSync(path, 'utf8'))

export const FileUtils = { readFileSync }
