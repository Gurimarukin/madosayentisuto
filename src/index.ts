import './Global'

import { Config } from './models/Config'

const config = Config.load()

console.log('config =', config)
