import { v4 } from 'uuid'

import { IO } from '../../shared/utils/fp'

const uuidV4: IO<string> = IO.tryCatch(() => v4())

export const UUIDUtils = { uuidV4 }
