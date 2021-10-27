export type MadEvent = AppStarted | DbReady

type AppStarted = { readonly type: 'AppStarted' }
const AppStarted: AppStarted = { type: 'AppStarted' }

type DbReady = { readonly type: 'DbReady' }
const DbReady: DbReady = { type: 'DbReady' }

export const MadEvent = {
  AppStarted,
  DbReady,
}
