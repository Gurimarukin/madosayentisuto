import type { Connector } from '../internals/index'
import type { HandlerManager, MonitorEventEmitter } from '../types/index'
import { useMonitorOutput } from './useMonitorOutput'

export function useCollectedProps<Collected, Monitor extends HandlerManager>(
  collector: ((monitor: Monitor) => Collected) | undefined,
  monitor: Monitor & MonitorEventEmitter,
  connector: Connector,
) {
  return useMonitorOutput(monitor, collector || (() => ({} as Collected)), () =>
    connector.reconnect(),
  )
}
