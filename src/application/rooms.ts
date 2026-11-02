import { randomUUID } from 'node:crypto'
import { NotFoundError, ValidationError } from '../domain/errors.ts'
import type { Room } from '../domain/plant.ts'
import { requireName } from './household.ts'
import type { RoomRepository } from './ports.ts'

export function makeRoomUseCases(deps: { rooms: RoomRepository }) {
  const { rooms } = deps

  function checkName(raw: string, exceptId?: string): string {
    const name = requireName(raw, 'Le nom de la pièce', 40)
    const existing = rooms.findByName(name)
    if (existing && existing.id !== exceptId) throw new ValidationError(`La pièce « ${name} » existe déjà`)
    return name
  }

  function requireRoom(id: string): Room {
    const room = rooms.get(id)
    if (!room) throw new NotFoundError('Pièce introuvable')
    return room
  }

  return {
    list: (): Room[] => rooms.list(),

    create(name: string): Room {
      const room = { id: randomUUID(), name: checkName(name) }
      rooms.save(room)
      return room
    },

    rename(id: string, name: string): Room {
      const room = { ...requireRoom(id), name: checkName(name, id) }
      rooms.save(room)
      return room
    },

    remove(id: string): void {
      requireRoom(id)
      rooms.remove(id)
    },
  }
}
