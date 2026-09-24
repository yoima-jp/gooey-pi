import { afterEach, describe, expect, it } from 'vitest'
import { formatSessionCost } from '../../src/lib/format-cost'
import { formatRelative } from '../../src/lib/data'
import { englishCatalog, formattingLocaleTag, japaneseCatalog, resolveLocale, setFormattingLocaleForTests, simplifiedChineseCatalog, translate } from '../../src/lib/i18n'

/**
 * The Simplified Chinese surfaces translated today: the navigation shell, the
 * project list chrome and the Appearance panel. Everything else falls back to
 * English for that locale, which the last test below pins explicitly.
 *
 * The covered set is declared here instead of being derived from the catalog so
 * that a change to this locale is deliberate: adding or dropping a translation
 * fails the test until the list is updated, and a listed key that is missing from
 * the English catalog fails too. It intentionally does not demand a translation
 * for every English key — that gap is a product decision, made visible by this
 * list sitting at 43 entries against `englishCatalog`.
 */
const SIMPLIFIED_CHINESE_COVERED_KEYS = [
  'appearance.description',
  'appearance.language.available',
  'appearance.language.description',
  'appearance.language.label',
  'appearance.language.system',
  'appearance.language.title',
  'appearance.motion.description',
  'appearance.motion.reduce',
  'appearance.motion.title',
  'appearance.text.aria',
  'appearance.text.default',
  'appearance.text.description',
  'appearance.text.label',
  'appearance.text.larger',
  'appearance.text.smaller',
  'appearance.text.title',
  'appearance.theme.dark',
  'appearance.theme.light',
  'appearance.theme.system',
  'appearance.theme.title',
  'appearance.title',
  'nav.activity',
  'nav.capabilities',
  'nav.projects',
  'nav.scheduled',
  'nav.settings',
  'projects.pin',
  'projects.sort',
  'projects.sort.alphabetical',
  'projects.sort.menu',
  'projects.sort.recent',
  'projects.unpin',
  'settings.about',
  'settings.appearance',
  'settings.browser',
  'settings.general',
  'settings.harness',
  'settings.pets',
  'settings.privacy',
  'settings.providers',
  'settings.sections',
  'settings.terminal',
  'settings.voice',
] as const

describe('i18n', () => {
  // The catalog type already rejects a missing Japanese key; this pins the same
  // invariant at runtime so a future catalogs-in-JSON split cannot regress it.
  it('translates every English catalog key', () => {
    expect(Object.keys(japaneseCatalog).sort()).toEqual(Object.keys(englishCatalog).sort())
  })

  it('keeps every catalog key on an English key', () => {
    for (const locale of ['zh-CN', 'ja'] as const) {
      const catalog = locale === 'zh-CN' ? simplifiedChineseCatalog : japaneseCatalog
      expect(Object.keys(catalog).filter((key) => !(key in englishCatalog)), `${locale} keys missing from the English catalog`).toEqual([])
    }
  })

  it('translates exactly the declared Simplified Chinese surfaces', () => {
    expect(Object.keys(simplifiedChineseCatalog).sort()).toEqual([...SIMPLIFIED_CHINESE_COVERED_KEYS].sort())
    for (const key of SIMPLIFIED_CHINESE_COVERED_KEYS) expect(englishCatalog[key], `${key} is not an English catalog key`).toBeDefined()
  })

  it('detects Simplified Chinese system locales without treating Traditional Chinese as Simplified', () => {
    expect(resolveLocale('system', ['zh-CN'])).toBe('zh-CN')
    expect(resolveLocale('system', ['zh-Hans-US'])).toBe('zh-CN')
    expect(resolveLocale('system', ['zh-TW', 'en-US'])).toBe('en')
    expect(resolveLocale('system', ['fr-FR', 'zh-SG'])).toBe('zh-CN')
  })

  it('detects Japanese system locales', () => {
    expect(resolveLocale('system', ['ja-JP'])).toBe('ja')
    expect(resolveLocale('system', ['ja'])).toBe('ja')
    expect(resolveLocale('system', ['fr-FR', 'ja-JP'])).toBe('ja')
  })

  it('uses the first supported system locale in preference order', () => {
    expect(resolveLocale('system', ['en-US', 'bg-US', 'zh-Hans-US'])).toBe('en')
    expect(resolveLocale('system', ['zh-Hans-US', 'en-US'])).toBe('zh-CN')
    expect(resolveLocale('system', ['ja-JP', 'en-US'])).toBe('ja')
    expect(resolveLocale('system', ['en-US', 'ja-JP'])).toBe('en')
    expect(resolveLocale('system', ['fr-FR', 'de-DE'])).toBe('en')
  })

  it('honors an explicit locale preference over the system locale', () => {
    expect(resolveLocale('en', ['zh-CN'])).toBe('en')
    expect(resolveLocale('zh-CN', ['en-US'])).toBe('zh-CN')
    expect(resolveLocale('ja', ['en-US'])).toBe('ja')
    expect(resolveLocale('ja', ['zh-CN'])).toBe('ja')
  })

  it('interpolates values, selects plural forms, and falls back to English', () => {
    expect(translate('en', 'appearance.language.available', { count: 1 })).toBe('1 language available')
    expect(translate('en', 'appearance.language.available', { count: 2 })).toBe('2 languages available')
    expect(translate('zh-CN', 'appearance.language.available', { count: 2 })).toBe('支持 2 种语言')
    expect(translate('zh-CN', 'common.reload')).toBe('Reload GooeyPi')
  })

  it('translates the Japanese catalog and interpolates its template values', () => {
    expect(translate('ja', 'nav.settings')).toBe('設定')
    expect(translate('ja', 'appearance.text.default')).toBe('標準')
    expect(translate('ja', 'appearance.language.system')).toBe('システム設定に従う')
    expect(translate('ja', 'appearance.language.available', { count: 3 })).toBe('3 言語に対応')
  })

  // Helpers such as `formatRelative` and `formatSessionCost` run outside React,
  // so they read the locale the provider mirrors instead of a hook. These cases
  // pin that the mirror actually reaches them.
  describe('plain-module locale mirror', () => {
    afterEach(() => setFormattingLocaleForTests('en'))

    const usage = { cost: null, tokens: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, total: 1 } }

    it('defaults to English before a provider renders', () => {
      expect(formattingLocaleTag()).toBe('en')
      expect(formatSessionCost(usage)).toBe('Pricing unavailable')
      expect(formatRelative(Date.now())).toBe('now')
    })

    it('formats through the mirrored locale', () => {
      setFormattingLocaleForTests('ja')
      expect(formattingLocaleTag()).toBe('ja')
      expect(formatSessionCost(usage)).toBe(translate('ja', 'cost.pricingUnavailable'))
      expect(formatRelative(Date.now())).toBe(translate('ja', 'time.now'))
      expect(formatRelative(Date.now() - 2 * 60 * 60 * 1000)).toBe(new Intl.RelativeTimeFormat('ja', { numeric: 'auto' }).format(-2, 'hour'))
      // Chinese has no catalog entry for either key, so it falls back to English.
      setFormattingLocaleForTests('zh-CN')
      expect(formatSessionCost(usage)).toBe('Pricing unavailable')
    })
  })
})
