import { Either, pipe } from '../../src/utils/fp'
import { ProcessUtils } from '../../src/utils/ProcessUtils'

describe('ProcessUtils.exec', () => {
  it('should return 0 for ls', () => {
    const res = pipe(ProcessUtils.exec('ls', ['README.md']))()
    return res.then(_ =>
      expect(_).toEqual(
        Either.right({
          code: 0,
          stdout: 'README.md\n',
          stderr: ''
        })
      )
    )
  })

  it('should return error for invalid command', () => {
    const res = pipe(ProcessUtils.exec('toto', ['titi']))()
    return res.then(_ =>
      expect(_).toEqual(
        Either.right({
          code: 127,
          stdout: '',
          stderr: '/bin/sh: toto: command not found\n'
        })
      )
    )
  })
})
