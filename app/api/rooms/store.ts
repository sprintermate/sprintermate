export interface Vote {
  userId: string
  userName: string
  points: number | null
  timestamp: number
}

export interface Room {
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
