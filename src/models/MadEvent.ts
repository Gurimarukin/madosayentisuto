export type MadEvent = AppStarted | IndexesEnsured

type AppStarted = { readonly type: 'AppStarted' }
const AppStarted: AppStarted = { type: 'AppStarted' }

type IndexesEnsured = { readonly type: 'IndexesEnsured' }
const IndexesEnsured: IndexesEnsured = { type: 'IndexesEnsured' }

export const MadEvent = {
  AppStarted,
  IndexesEnsured,
}
