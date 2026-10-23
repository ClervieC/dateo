import { useEffect, useState } from 'react'
import { Appearance, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Palettes. Contrastes vérifiés (WCAG AA, ≥ 4,5:1 pour le texte courant) sur le fond
// et les cartes de chaque mode ; « primary » est la couleur de remplissage (boutons,
// puces actives : texte blanc ≥ 4,5:1), « primaryText » celle des textes et liens roses.
const light = {
  bg: '#FFF8F5',
  bgAlt: '#FFF4F7',
  card: '#FFFFFF',
  border: '#F0D9D9',
  borderStrong: '#D0C5C0',
  text: '#5C4A45',
  muted: '#6B5E5A',
  faint: '#7A6B66',
  primary: '#C8466F',
  primaryText: '#B83B66',
  primarySoft: '#FDE8F0',
  primaryBorder: '#F4C0D1',
  primaryDark: '#8E2A50',
  onPrimary: '#FFFFFF',
  danger: '#C04A22',
  dangerBorder: '#F0B8A8',
  success: '#3B6D11',
  successBg: '#E7F3DD',
  errorBg: '#FDE8DE',
  errorText: '#993C1D',
  warningBg: '#FFF3D6',
  warningText: '#7A5C14',
  skeleton: '#F3E4E2',
  overlay: 'rgba(0,0,0,0.4)',
}

export type Palette = typeof light

const dark: Palette = {
  bg: '#1B1416',
  bgAlt: '#221A1D',
  card: '#261D20',
  border: '#3D2F34',
  borderStrong: '#4F3E44',
  text: '#F3E9E6',
  muted: '#BDB0AC',
  faint: '#A09390',
  primary: '#C8466F',
  primaryText: '#EF7BA2',
  primarySoft: '#3A2129',
  primaryBorder: '#5A3142',
  primaryDark: '#F29BB8',
  onPrimary: '#FFFFFF',
  danger: '#F2855E',
  dangerBorder: '#5A2E22',
  success: '#86C657',
  successBg: '#1E2D14',
  errorBg: '#3A1F18',
  errorText: '#F5AE93',
  warningBg: '#3A2E14',
  warningText: '#E8C873',
  skeleton: '#33272B',
  overlay: 'rgba(0,0,0,0.6)',
}

export type ThemeName = 'light' | 'dark'
export type ThemePref = 'system' | ThemeName

const PALETTES: Record<ThemeName, Palette> = { light, dark }
const STORAGE_KEY = 'appTheme'

// Palette courante, mutée en place au changement de thème. Les écrans la lisent au
// rendu (C.primary…) ; le layout racine remonte la navigation au changement de thème.
export const C: Palette = { ...light }

let pref: ThemePref = 'system'
let current: ThemeName = 'light'
const listeners = new Set<(name: ThemeName) => void>()

function resolve(p: ThemePref): ThemeName {
  if (p !== 'system') return p
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
}

function apply(name: ThemeName) {
  if (name === current) return
  current = name
  Object.assign(C, PALETTES[name])
  listeners.forEach((l) => l(name))
}

export function getThemeName(): ThemeName {
  return current
}

export function getThemePref(): ThemePref {
  return pref
}

export function setThemePref(p: ThemePref) {
  pref = p
  AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {})
  apply(resolve(p))
}

export async function initTheme(): Promise<ThemeName> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (stored === 'system' || stored === 'light' || stored === 'dark') pref = stored
  } catch {}
  apply(resolve(pref))
  // En mode « Système », suit le changement clair/sombre du téléphone en direct
  Appearance.addChangeListener(() => { if (pref === 'system') apply(resolve('system')) })
  return current
}

export function useThemeName(): ThemeName {
  const [name, setName] = useState(current)
  useEffect(() => {
    listeners.add(setName)
    setName(current)
    return () => { listeners.delete(setName) }
  }, [])
  return name
}

// ---------- Police ----------
// Nunito, chargée par le layout racine. Les styles de texte reçoivent la variante
// correspondant à leur fontWeight (une famille par graisse, nécessaire sur Android).
let fontsReady = false
export function setFontsReady(ready: boolean) { fontsReady = ready }

const FONT_BY_WEIGHT: Record<string, string> = {
  '100': 'Nunito_400Regular', '200': 'Nunito_400Regular', '300': 'Nunito_400Regular',
  '400': 'Nunito_400Regular', normal: 'Nunito_400Regular',
  '500': 'Nunito_500Medium',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold', bold: 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold', '900': 'Nunito_800ExtraBold',
}

export function fontFor(weight?: string | number): string | undefined {
  if (!fontsReady) return undefined
  return FONT_BY_WEIGHT[String(weight ?? '400')] ?? 'Nunito_400Regular'
}

function withFonts<T extends Record<string, any>>(styles: T): T {
  if (!fontsReady) return styles
  const out: Record<string, any> = {}
  for (const [key, style] of Object.entries(styles)) {
    if (style && typeof style === 'object' && !Array.isArray(style) && ('fontSize' in style || 'fontWeight' in style) && !style.fontFamily) {
      const { fontWeight, ...rest } = style
      out[key] = { ...rest, fontFamily: fontFor(fontWeight) }
    } else {
      out[key] = style
    }
  }
  return out as T
}

// Remplace StyleSheet.create : la feuille de styles est recalculée (et mise en cache)
// pour chaque thème, avec la police appliquée. S'utilise exactement comme avant :
// const styles = themedStyles(() => ({ card: { backgroundColor: C.card } }))
// Même signature que StyleSheet.create, pour garder le typage exact des styles
export function themedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T & StyleSheet.NamedStyles<any>,
): T {
  const cache: Record<string, T> = {}
  const get = () => {
    const k = `${current}-${fontsReady}`
    return (cache[k] ??= withFonts(factory()))
  }
  return new Proxy({} as T, {
    get: (_target, prop) => (get() as any)[prop as string],
    has: (_target, prop) => prop in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_target, prop) => ({ ...Object.getOwnPropertyDescriptor(get(), prop), configurable: true }),
  })
}
