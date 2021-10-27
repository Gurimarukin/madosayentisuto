export type MadEvent = AppStarted | DbReady | CronJob

type AppStarted = { readonly type: 'AppStarted' }
const AppStarted: AppStarted = { type: 'AppStarted' }

type DbReady = { readonly type: 'DbReady' }
const DbReady: DbReady = { type: 'DbReady' }

type CronJob = { readonly type: 'CronJob' }
const CronJob: CronJob = { type: 'CronJob' }

export const MadEvent = {
  AppStarted,
  DbReady,
  CronJob,
}
