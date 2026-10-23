import { TOPIC_CATEGORIES, melangerQuestions } from './conversationTopics'

describe('TOPIC_CATEGORIES', () => {
  it('a des clés uniques et des questions dans chaque catégorie', () => {
    const keys = TOPIC_CATEGORIES.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const c of TOPIC_CATEGORIES) expect(c.questions.length).toBeGreaterThan(3)
  })
})

describe('melangerQuestions', () => {
  const questions = ['a', 'b', 'c', 'd', 'e', 'f']

  it('garde toutes les questions, sans doublon', () => {
    const result = melangerQuestions(questions, 42)
    expect([...result].sort()).toEqual(questions)
  })

  it('est stable pour un même seed', () => {
    expect(melangerQuestions(questions, 7)).toEqual(melangerQuestions(questions, 7))
  })

  it('ne modifie pas le tableau d\'origine', () => {
    melangerQuestions(questions, 3)
    expect(questions).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })
})
