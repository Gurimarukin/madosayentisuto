// tslint:disable-next-line:no-reference
///<reference path="Global.d.ts" />

// tslint:disable-next-line:semicolon
;(global as any).todo = (..._: any): never => {
  throw Error('missing implementation')
}
