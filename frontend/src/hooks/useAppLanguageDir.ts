import { useEffect, useMemo } from 'react'
import type { i18n as I18nInstance } from 'i18next'

export function useAppLanguageDir(i18n: I18nInstance) {
  const dir = useMemo(() => (i18n.language === 'fr' ? 'ltr' : 'rtl'), [i18n.language])
  const lang = useMemo(() => (i18n.language === 'fr' ? 'fr' : 'ar'), [i18n.language])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [dir, lang])

  return { dir, lang }
}

