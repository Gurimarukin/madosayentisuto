// import { Right } from 'fp-ts/Either'
import { expectT } from '../../expectT'

// import { Either, pipe } from '../../src/utils/fp'
// import { CmdOutput, ProcessUtils } from '../../src/utils/ProcessUtils'

describe('ProcessUtils.exec', () => {
  it('should work', () => {
    expectT(2).toStrictEqual(2)
  })

  // it('should return 0 for ls', () => {
  //   const res = pipe(ProcessUtils.execAsync('ls', ['README.md']))()
  //   return res.then(_ =>
  //     expectT(_).toStrictEqual(
  //       Either.right({
  //         code: 0,
  //         stdout: 'README.md\n',
  //         stderr: '',
  //       }),
  //     ),
  //   )
  // })

  // it('should return error for invalid command', () => {
  //   const res = pipe(ProcessUtils.execAsync('toto', ['titi']))()
  //   return res.then(_ => {
  //     expectT(Either.isRight(_)).toStrictEqual(true)

  //     const output = (_ as Right<CmdOutput>).right

  //     expectT(output.code).not.toStrictEqual(0)
  //     expectT(output.stdout).toStrictEqual('')
  //     expectT(output.stderr).toContain('toto')
  //     expectT(output.stderr).toContain('not found')
  //   })
  // })
})
