export {}

declare global {
  function todo(...args: any[]): never
}

;(global as any).todo = (..._: any): never => {
  throw Error('missing implementation')
}
