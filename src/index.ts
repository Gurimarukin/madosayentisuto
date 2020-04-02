import './Global'

import { Config } from './config/Config'

const config = Config.load()

console.log('config =', config())
