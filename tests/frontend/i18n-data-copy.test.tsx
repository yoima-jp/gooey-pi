// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, translate, type MessageKey } from '../../src/lib/i18n'
import { PI_MCP_ADAPTER_REQUIRED_DETAIL } from '../../src/lib/mcp-policy'
import { isUntitledSessionTitle, sessionTitleText, UNTITLED_SESSION_TITLE } from '../../src/lib/session-title'
import { PluginsPage } from '../../src/pages/PluginsPage'
import type { SkillRecord } from '../../src/types/api'

// Some interface copy reaches the renderer as data rather than as a literal: the
// main process stores a session's placeholder title, and it reports capability
// availability details as fixed English sentences. Both are mapped back onto
// catalog keys for display, which is what these cases pin.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const japanese = (key: MessageKey, values?: Record<string, string | number>) => translate('ja', key, values)

describe('copy that arrives as data', () => {
  it('treats the session placeholder as a sentinel and localises only its display', () => {
    expect(isUntitledSessionTitle(UNTITLED_SESSION_TITLE)).toBe(true)
    expect(isUntitledSessionTitle('Ship the settings page')).toBe(false)
    expect(isUntitledSessionTitle(undefined)).toBe(false)
    expect(sessionTitleText(UNTITLED_SESSION_TITLE, japanese)).toBe('名称未設定のセッション')
    // Real titles stay untouched because they are user data.
    expect(sessionTitleText('Ship the settings page', japanese)).toBe('Ship the settings page')
  })

  describe('capability availability details', () => {
    let container: HTMLDivElement
    let root: Root
    beforeEach(() => {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
    })
    afterEach(() => { act(() => root.unmount()); container.remove() })

    it('shows a known main-process detail in the interface language and passes unknown ones through', async () => {
      const known: SkillRecord = {
        id: 'mcp-pi-core', name: 'Pi MCP', description: 'Model context servers.', kind: 'mcp', location: 'user', enabled: false,
        availability: { available: false, detail: PI_MCP_ADAPTER_REQUIRED_DETAIL },
      }
      const unknown: SkillRecord = {
        id: 'mcp-vendor', name: 'Vendor MCP', description: 'Vendor servers.', kind: 'mcp', location: 'user', enabled: false,
        availability: { available: false, detail: 'Install the vendor driver before enabling this server.' },
      }
      await act(async () => {
        root.render(<I18nProvider preference="ja"><PluginsPage
          harness="omp" skills={[known, unknown]} warnings={[]} loading={false}
          askUserEnabled={true} onSetAskUserEnabled={async () => undefined}
          browserEnabled={true} onSetBrowserEnabled={async () => undefined}
          computerUseEnabled={false} onSetComputerUseEnabled={async () => undefined} onOpenExternal={() => undefined}
          onRefresh={async () => undefined} onInstall={async () => ({ ok: true, output: '' })}
          onInstallExtension={async () => ({ ok: true, output: '' })}
          onSetMcpSupport={async () => ({ ok: true, output: '' })}
          onConnectMcp={async () => ({ ok: true, output: '' })}
          onSetMcpEnabled={async () => ({ ok: true, output: '' })}
        /></I18nProvider>)
      })

      const text = container.textContent ?? ''
      expect(text).toContain(translate('ja', 'plugins.warning.piMcpAdapterRequired'))
      expect(text).not.toContain(PI_MCP_ADAPTER_REQUIRED_DETAIL)
      // Harness-owned or vendor-generated detail text is shown verbatim.
      expect(text).toContain('Install the vendor driver before enabling this server.')
    })
  })
})
