import { TSnowflake } from '../models/TSnowflake'

export type Commands = Commands.DefaultRoleGet | Commands.DefaultRoleSet

export namespace Commands {
  export interface DefaultRoleGet {
    _tag: 'DefaultRoleGet'
  }
  export const DefaultRoleGet: DefaultRoleGet = { _tag: 'DefaultRoleGet' }

  export interface DefaultRoleSet {
    _tag: 'DefaultRoleSet'
    role: TSnowflake
  }
  export const DefaultRoleSet = (role: TSnowflake): DefaultRoleSet => ({
    _tag: 'DefaultRoleSet',
    role
  })
}
