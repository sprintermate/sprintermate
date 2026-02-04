import { NextRequest, NextResponse } from 'next/server'
import { rooms } from '../store'

export async function POST(request: NextRequest) {
  try {
    const { roomId, userId, userName, points } = await request.json()

    if (!roomId || !userId || !userName) {
      return NextResponse.json(
        { error: 'Room ID, user ID, and user name are required' },
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

    // Update or add vote
    const existingVoteIndex = room.votes.findIndex(v => v.userId === userId)
    
    const vote = {
      userId,
      userName,
      points: points ?? null,
      timestamp: Date.now()
    }

    if (existingVoteIndex >= 0) {
      room.votes[existingVoteIndex] = vote
    } else {
      room.votes.push(vote)
    }

    return NextResponse.json({ success: true, room })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
