import fs from 'fs'
import * as t from 'io-ts'

const ConfigCodec = t.strict({
  discord: t.strict({
    clientSecret: t.string
  })
})

export type Config = t.TypeOf<typeof ConfigCodec>

export namespace Config {
  export function load(): Config {
    const applicationConf = readFile('./conf/application.conf.json')
    const localConf = readFile('./conf/local.conf.json')

    todo(applicationConf, localConf)
  }
}

function readFile(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
