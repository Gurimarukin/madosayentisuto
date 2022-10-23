import * as C from 'io-ts/Codec'

import { MessageId } from '../../MessageId'
import { RoleId } from '../../RoleId'
import type { AutoroleMessage } from '../AutoRoleMessage'

const codec = C.struct({
  message: MessageId.codec, // listen reactions to this message
  role: RoleId.codec, // autorole this role
})

const fromAutoroleMessage = ({ message, role }: AutoroleMessage): AutoroleMessageDb => ({
  message: MessageId.fromMessage(message),
  role: RoleId.fromRole(role),
})

type AutoroleMessageDb = C.TypeOf<typeof codec>
const AutoroleMessageDb = { codec, fromAutoroleMessage }

export { AutoroleMessageDb }
