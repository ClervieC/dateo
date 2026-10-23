import { tKey } from './i18n'

export type TopicCategory = {
  key: string
  emoji: string
  label: string
  questions: string[]
}

// Questions prêtes à l'emploi, disponibles hors ligne et sans IA.
export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    key: 'glace',
    emoji: '🧊',
    label: tKey("Briser la glace"),
    questions: [
      tKey("C'est quoi le meilleur truc qui t'est arrivé cette semaine ?"),
      tKey("Tu es plutôt du matin ou du soir ?"),
      tKey("Qu'est-ce que tu fais quand tu as une journée entière rien que pour toi ?"),
      tKey("Quel est le dernier endroit où tu t'es dit « il faut que j'y retourne » ?"),
      tKey("Si tu devais manger un seul plat toute ta vie, ce serait lequel ?"),
      tKey("Tu as une série ou un livre à me conseiller en ce moment ?"),
      tKey("C'est quoi ta chanson du moment ?"),
      tKey("Quel est le meilleur conseil qu'on t'ait donné ?"),
    ],
  },
  {
    key: 'connaitre',
    emoji: '🌱',
    label: tKey("Mieux se connaître"),
    questions: [
      tKey("Qu'est-ce qui te passionnait quand tu étais enfant ?"),
      tKey("De quoi es-tu le/la plus fier·e ces dernières années ?"),
      tKey("Qu'est-ce que tes amis diraient de toi en trois mots ?"),
      tKey("Quelle compétence aimerais-tu apprendre si tu avais le temps ?"),
      tKey("C'est quoi ta journée parfaite, du réveil au coucher ?"),
      tKey("Quelle tradition familiale tu aimerais garder plus tard ?"),
      tKey("Qu'est-ce qui te fait vraiment rire ?"),
      tKey("Il y a un endroit qui te ressemble ?"),
    ],
  },
  {
    key: 'fun',
    emoji: '🎲',
    label: tKey("Fun & décalé"),
    questions: [
      tKey("Si tu pouvais avoir un super-pouvoir complètement inutile, ce serait lequel ?"),
      tKey("Quel est ton talent caché le plus bizarre ?"),
      tKey("Tu gagnes au loto demain : quelle est la première chose que tu fais ?"),
      tKey("Si ta vie était un film, quel serait son titre ?"),
      tKey("Quel animal serait le plus drôle s'il pouvait parler ?"),
      tKey("Tu préfères pouvoir voler ou respirer sous l'eau ?"),
      tKey("C'est quoi ton plus gros fou rire ?"),
      tKey("Quelle tendance tu ne comprendras jamais ?"),
    ],
  },
  {
    key: 'profond',
    emoji: '💭',
    label: tKey("Plus profond"),
    questions: [
      tKey("Qu'est-ce qui compte le plus pour toi dans une relation ?"),
      tKey("Quelle expérience t'a le plus changé·e ?"),
      tKey("Qu'est-ce que tu aimerais avoir accompli dans dix ans ?"),
      tKey("À quel moment tu te sens le plus toi-même ?"),
      tKey("Qu'est-ce que tu dirais à toi d'il y a cinq ans ?"),
      tKey("C'est quoi pour toi une vie réussie ?"),
      tKey("Quelle peur aimerais-tu dépasser ?"),
      tKey("Quelle personne t'a le plus inspiré·e ?"),
    ],
  },
  {
    key: 'couple',
    emoji: '💑',
    label: tKey("En couple"),
    questions: [
      tKey("Quel est ton souvenir préféré de nous deux ?"),
      tKey("Qu'est-ce que tu as pensé de moi la première fois qu'on s'est vus ?"),
      tKey("Quel voyage aimerais-tu qu'on fasse ensemble ?"),
      tKey("Qu'est-ce qu'on devrait faire plus souvent tous les deux ?"),
      tKey("Il y a une petite chose que je fais qui te rend heureux·se ?"),
      tKey("Quelle nouvelle activité on pourrait tester ensemble ce mois-ci ?"),
      tKey("Comment tu imagines nos dimanches dans cinq ans ?"),
      tKey("Quelle chanson te fait penser à nous ?"),
    ],
  },
]

// Mélange déterministe pour un `seed` donné : permet d'afficher un autre lot de
// questions à chaque « Mélanger » sans répéter le même ordre.
export function melangerQuestions(questions: string[], seed: number): string[] {
  const arr = [...questions]
  let x = Math.abs(Math.floor(seed)) % 2147483647 || 1
  for (let i = arr.length - 1; i > 0; i--) {
    x = (x * 16807) % 2147483647
    const j = x % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
