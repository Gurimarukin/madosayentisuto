import type { HealthCheckPersistence } from '../persistence/HealthCheckPersistence'

export type HealthCheckService = ReturnType<typeof HealthCheckService>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const HealthCheckService = (healthCheckPersistence: HealthCheckPersistence) => {
  const { check } = healthCheckPersistence

  return { check }
}
