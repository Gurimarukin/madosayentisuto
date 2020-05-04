import { Config } from './config/Config'
import { IO } from './utils/fp'

const main = (): IO<unknown> => Config.load()

IO.runUnsafe(main())
