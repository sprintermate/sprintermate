// In-memory storage for rooms (in production, use Redis or database)
interface Vote {
  userId: string
  userName: string
  points: number | null
  timestamp: number
}

interface Room {
  id: string
  name: string
  workItem: {
    title: string
    description: string
  } | null
  votes: Vote[]
  revealed: boolean
  createdAt: number
}

const rooms = new Map<string, Room>()

export { rooms, type Room, type Vote }
