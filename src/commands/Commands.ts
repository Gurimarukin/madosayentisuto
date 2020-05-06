import { TSnowflake } from '../models/TSnowflake'

export type Commands = Commands.DefaultRoleSet

export namespace Commands {
  export interface DefaultRoleSet {
    _tag: 'DefaultRoleSet'
    role: TSnowflake
  }
  export const DefaultRoleSet = (role: TSnowflake): Commands => ({ _tag: 'DefaultRoleSet', role })
}
