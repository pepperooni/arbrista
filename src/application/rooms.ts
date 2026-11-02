import { randomUUID } from 'node:crypto'
import { NotFoundError, ValidationError } from '../domain/errors.ts'
import type { Room } from '../domain/plant.ts'
import { requireName } from './household.ts'
import type { RoomRepository } from './ports.ts'

export function makeRoomUseCases(deps: { rooms: RoomRepository }) {
  const { rooms } = deps

  async function checkName(raw: string, exceptId?: string): Promise<string> {
    const name = requireName(raw, 'Le nom de la pièce', 40)
    const existing = await rooms.findByName(name)
    if (existing && existing.id !== exceptId) throw new ValidationError(`La pièce « ${name} » existe déjà`)
    return name
  }

  async function requireRoom(id: string): Promise<Room> {
    const room = await rooms.get(id)
    if (!room) throw new NotFoundError('Pièce introuvable')
    return room
  }

  return {
    list: (): Promise<Room[]> => rooms.list(),

    async create(name: string): Promise<Room> {
      const room = { id: randomUUID(), name: await checkName(name) }
      await rooms.save(room)
      return room
    },

    async rename(id: string, name: string): Promise<Room> {
      const room = { ...(await requireRoom(id)), name: await checkName(name, id) }
      await rooms.save(room)
      return room
    },

    async remove(id: string): Promise<void> {
      await requireRoom(id)
      await rooms.remove(id)
    },
  }
}
