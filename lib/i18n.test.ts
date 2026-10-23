import * as fs from 'fs'
import * as path from 'path'
import { en } from './i18n.en'
import { t, tn, setLang } from './i18n'

const ROOT = path.join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : []
  })
}

const STRING = `(["'])((?:\\\\.|(?!\\1).)*)\\1`
const unescape = (s: string) => s.replace(/\\(["'\\])/g, '$1').replace(/\\n/g, '\n')

// Toutes les clés passées à t("…"), tKey("…") et tn(n, "…", "…") dans l'app
function collectKeys(): { key: string; file: string }[] {
  const keys: { key: string; file: string }[] = []
  const single = new RegExp(`\\b(?:t|tKey)\\(\\s*${STRING}`, 'g')
  const plural = new RegExp(`\\btn\\([^,()]+(?:\\([^()]*\\))?[^,()]*,\\s*${STRING}\\s*,\\s*(["'])((?:\\\\.|(?!\\3).)*)\\3`, 'g')
  for (const file of [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'lib'))]) {
    const src = fs.readFileSync(file, 'utf8')
    const rel = path.relative(ROOT, file)
    for (const m of src.matchAll(single)) keys.push({ key: unescape(m[2]), file: rel })
    for (const m of src.matchAll(plural)) {
      keys.push({ key: unescape(m[2]), file: rel })
      keys.push({ key: unescape(m[4]), file: rel })
    }
  }
  return keys
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

describe('traductions anglaises', () => {
  const keys = collectKeys()

  it('trouve bien des clés dans le code', () => {
    expect(keys.length).toBeGreaterThan(300)
  })

  it('chaque texte de l\'app a une traduction anglaise', () => {
    const missing = [...new Set(keys.filter(({ key }) => !(key in en)).map(({ key, file }) => `${file}: ${key}`))]
    expect(missing).toEqual([])
  })

  it('les traductions gardent les mêmes {variables}', () => {
    const mismatched = Object.entries(en)
      .filter(([fr, eng]) => placeholders(fr) !== placeholders(eng))
      .map(([fr]) => fr)
    expect(mismatched).toEqual([])
  })
})

describe('t / tn', () => {
  afterEach(() => setLang('fr'))

  it('renvoie le français par défaut et remplace les variables', () => {
    expect(t('Encore {n} caractère(s)', { n: 3 })).toBe('Encore 3 caractère(s)')
  })

  it("traduit en anglais quand la langue est 'en'", () => {
    setLang('en')
    expect(t('Se connecter')).toBe('Log in')
    expect(tn(2, '{n} date', '{n} dates')).toBe('2 dates')
  })

  it('retombe sur le français pour une clé inconnue', () => {
    setLang('en')
    expect(t('Clé qui n’existe pas')).toBe('Clé qui n’existe pas')
  })
})
