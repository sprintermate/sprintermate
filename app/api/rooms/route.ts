import { NextRequest, NextResponse } from 'next/server'
import { Room } from './store'
import redis from '../redis'

export async function POST(request: NextRequest) {
  try {
    const { roomId, name } = await request.json()

    if (!roomId || !name) {
      return NextResponse.json(
        { error: 'Room ID and name are required' },
        { status: 400 }
      )
    }

    const exists = await redis.exists(`room:${roomId}`)
    if (exists) {
      return NextResponse.json(
        { error: 'Room already exists' },
        { status: 409 }
      )
    }

    const room: Room = {
      id: roomId,
      name,
      workItem: null,
      votes: [],
      revealed: false,
      createdAt: Date.now()
    }

    await redis.set(`room:${roomId}`, JSON.stringify(room))

    return NextResponse.json({ success: true, room })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

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
    return NextResponse.json({ room })
  } catch (error) {
    console.error('Get room error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
