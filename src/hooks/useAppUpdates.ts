import { useCallback, useEffect, useState } from 'react'
import { formattingLocaleTag, translate } from '@/lib/i18n'
import type { AppUpdateState, PrimeWorkApi } from '@/types/api'

/**
 * The update control is rendered by the App shell, which sits above
 * `I18nProvider`, so the copy is resolved through the app-wide locale mirror
 * rather than the React context. The main process owns every other message in
 * `AppUpdateState`; this is the only one GooeyPi composes itself.
 */
function unsupportedState(): AppUpdateState {
  return { phase: 'unsupported', message: translate(formattingLocaleTag(), 'update.automaticMessage') }
}

export function useAppUpdates(bridge: PrimeWorkApi | null, reportError: (error: unknown) => void) {
  const [state, setState] = useState<AppUpdateState>(() => bridge ? { phase: 'idle' } : unsupportedState())

  useEffect(() => {
    if (!bridge) {
      // Rebuilt here rather than at module load so it follows the current
      // interface language instead of the language at import time.
      setState(unsupportedState())
      return
    }
    let cancelled = false
    const unsubscribe = bridge.updates.onChanged((next) => { if (!cancelled) setState(next) })
    void bridge.updates.getState()
      .then((next) => { if (!cancelled) setState(next) })
      .catch((error) => { if (!cancelled) reportError(error) })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [bridge, reportError])

  const act = useCallback(async () => {
    if (!bridge) return
    try {
      // The onChanged subscription is the single writer for main-process state.
      if (state.phase === 'available' || state.phase === 'downloaded') await bridge.updates.downloadAndInstall()
      else await bridge.updates.check()
    } catch (error) {
      reportError(error)
    }
  }, [bridge, reportError, state.phase])

  return { state, act }
}
