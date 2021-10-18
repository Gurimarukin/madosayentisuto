import { Right } from 'fp-ts/Either'

import { Either, pipe } from '../../src/utils/fp'
import { CmdOutput, ProcessUtils } from '../../src/utils/ProcessUtils'

describe('ProcessUtils.exec', () => {
  it('should return 0 for ls', () => {
    const res = pipe(ProcessUtils.execAsync('ls', ['README.md']))()
    return res.then(_ =>
      expect(_).toStrictEqual(
        Either.right({
          code: 0,
          stdout: 'README.md\n',
          stderr: '',
        }),
      ),
    )
  })

  it('should return error for invalid command', () => {
    const res = pipe(ProcessUtils.execAsync('toto', ['titi']))()
    return res.then(_ => {
      expect(Either.isRight(_)).toStrictEqual(true)

      const output = (_ as Right<CmdOutput>).right

      expect(output.code).not.toStrictEqual(0)
      expect(output.stdout).toStrictEqual('')
      expect(output.stderr).toContain('toto')
      expect(output.stderr).toContain('not found')
    })
  })
})
