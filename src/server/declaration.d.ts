declare module '@phc/argon2' {}

declare module 'upash' {
  // eslint-disable-next-line functional/no-return-void
  export declare const install: (name: string, algorithm: unknown) => void
  export declare const hash: (clearPassword: string) => Promise<string>
  export declare const verify: (hashedPassword: string, clearPassword: string) => Promise<boolean>
}
