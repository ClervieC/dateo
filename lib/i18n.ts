import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { en } from './i18n.en'

export type Lang = 'fr' | 'en'
export const LANGS: { key: Lang; label: string; flag: string }[] = [
  { key: 'fr', label: 'Français', flag: '🇫🇷' },
  { key: 'en', label: 'English', flag: '🇬🇧' },
]

const STORAGE_KEY = 'appLanguage'

// Le français est la langue source : le texte français sert de clé de traduction.
// Une clé absente du dictionnaire anglais s'affiche donc en français plutôt que vide
// (et le test i18n.test.ts signale toute clé non traduite).
let current: Lang = 'fr'
const listeners = new Set<(lang: Lang) => void>()

export function getLang(): Lang {
  return current
}

type Params = Record<string, string | number | null | undefined>

export function t(key: string, params?: Params): string {
  let s = current === 'en' ? (en[key] ?? key) : key
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (match: string, name: string) => (params[name] != null ? String(params[name]) : match))
  }
  return s
}

// Utilisé quand le texte n'est pas une clé fixe (ex : choix d'une variante selon un nombre)
// En français 0 et 1 sont au singulier (« 0 date »), en anglais seul 1 l'est (« 0 dates »).
export function tn(count: number, singular: string, plural: string, params?: Params): string {
  const isPlural = current === 'en' ? count !== 1 : count > 1
  return t(isPlural ? plural : singular, { n: count, ...params })
}

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {})
  listeners.forEach((l) => l(lang))
}

export function detectDeviceLang(): Lang {
  try {
    const locale = Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? navigator.language
      : Intl.DateTimeFormat().resolvedOptions().locale
    return locale?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  } catch {
    return 'fr'
  }
}

// À appeler au démarrage : langue choisie précédemment, sinon celle du téléphone
export async function initLanguage(): Promise<Lang> {
  let lang: Lang
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    lang = stored === 'fr' || stored === 'en' ? stored : detectDeviceLang()
  } catch {
    lang = detectDeviceLang()
  }
  current = lang
  listeners.forEach((l) => l(lang))
  return lang
}

export function useLang(): Lang {
  const [lang, setLangState] = useState(current)
  useEffect(() => {
    listeners.add(setLangState)
    setLangState(current)
    return () => { listeners.delete(setLangState) }
  }, [])
  return lang
}

// Marque un texte défini hors rendu (constantes de module) comme clé de traduction :
// renvoie la clé telle quelle, à traduire avec t() au moment de l'affichage.
export const tKey = (key: string) => key
