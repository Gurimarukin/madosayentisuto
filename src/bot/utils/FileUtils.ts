import fs from 'fs'

import { IO } from '../../shared/utils/fp'

const readFileSync = (path: string): IO<string> => IO.tryCatch(() => fs.readFileSync(path, 'utf8'))

export const FileUtils = { readFileSync }
