import { NextRequest, NextResponse } from 'next/server'
import { Room } from '../store'
import redis from '../../redis'

export async function POST(request: NextRequest) {
  try {
    const { roomId, revealed } = await request.json()

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      )
    }

    const roomStr = await redis.get(`room:${roomId}`)
    if (!roomStr) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }
    const room: Room = JSON.parse(roomStr)
    room.revealed = revealed
    await redis.set(`room:${roomId}`, JSON.stringify(room))
    return NextResponse.json({ success: true, room })
  } catch (error) {
    console.error('Reveal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
