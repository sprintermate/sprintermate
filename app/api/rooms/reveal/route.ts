import { NextRequest, NextResponse } from 'next/server'
import { rooms } from '../store'

export async function POST(request: NextRequest) {
  try {
    const { roomId, revealed } = await request.json()

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      )
    }

    const room = rooms.get(roomId)

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    room.revealed = revealed

    return NextResponse.json({ success: true, room })
  } catch (error) {
    console.error('Reveal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
