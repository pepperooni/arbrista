import { expect, it } from 'vitest'
import { largerThumbnail } from '../../src/shared/wikimedia.ts'

it('asks Wikimedia for a larger rendition of a thumbnail', () => {
  expect(largerThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Monstera.jpg/320px-Monstera.jpg', 1280)).toBe(
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Monstera.jpg/1280px-Monstera.jpg',
  )
})

it('leaves an original file (not a thumbnail) untouched', () => {
  const original = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Monstera.jpg'
  expect(largerThumbnail(original, 1280)).toBe(original)
})

it('never asks for a smaller rendition than the one it has', () => {
  const big = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/M.jpg/2000px-M.jpg'
  expect(largerThumbnail(big, 1280)).toBe(big)
})
