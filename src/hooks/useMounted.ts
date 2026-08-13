import { useSyncExternalStore } from "react"

function subscribe() {
  return () => {}
}

export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
