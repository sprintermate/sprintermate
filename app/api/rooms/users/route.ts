import { NextRequest, NextResponse } from 'next/server'
import redis from '../../redis'

// GET /api/rooms/users?roomId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }
    const users = await redis.hgetall(`room-users:${roomId}`)
    // users: { [userNameLower]: jsonString }
    const userList = Object.values(users).map(str => {
      try {
        return JSON.parse(str)
      } catch {
        return null
      }
    }).filter(Boolean)
    return NextResponse.json({ users: userList })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
