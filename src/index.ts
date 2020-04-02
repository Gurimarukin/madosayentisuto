import './Global'

import { Config } from './config/Config'
import { Console } from './utils/Console'

function main(): IO<void> {
  return pipe(
    Config.load(),
    IO.chain(config => Console.log('config =', config))
  )
}

pipe(main()(), Either.mapLeft(_ => { throw _ }))
