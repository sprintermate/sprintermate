import { NextRequest, NextResponse } from 'next/server'
import { Room } from '../store'
import redis from '../../redis'

export async function POST(request: NextRequest) {
  try {
    const { roomId, userId, userName, points } = await request.json()

    if (!roomId || !userId || !userName) {
      return NextResponse.json(
        { error: 'Room ID, user ID, and user name are required' },
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

    // userName unique ve case-insensitive kontrolü
    const lowerUserName = userName.trim().toLocaleLowerCase('tr-TR')
    const nameExists = room.votes.some(v => v.userName.trim().toLocaleLowerCase('tr-TR') === lowerUserName)
    const existingVoteIndex = room.votes.findIndex(v => v.userName.trim().toLocaleLowerCase('tr-TR') === lowerUserName)
    const vote = {
      userId,
      userName,
      points: points ?? null,
      timestamp: Date.now()
    }
    if (existingVoteIndex >= 0) {
      // Eğer mevcut kayıt kahve molasıysa ve yeni oy null ise, kahve molasında kalmaya devam et
      let finalPoints = points;
      const prevVote = room.votes[existingVoteIndex];
      if (prevVote.points === -1 && (points === null || points === undefined)) {
        finalPoints = -1;
      }
      const updatedVote = {
        userId,
        userName,
        points: finalPoints ?? null,
        timestamp: Date.now()
      }
      room.votes[existingVoteIndex] = updatedVote
    } else {
      if (nameExists) {
        return NextResponse.json(
          { error: `Bu odada '${userName}' adında birisi zaten var. Lütfen farklı bir isimle katılın.` },
          { status: 409 }
        )
      }
      room.votes.push(vote)
      // Katılımı ayrı bir anahtarda da kaydet
      await redis.hset(`room-users:${roomId}`, userName.trim().toLocaleLowerCase('tr-TR'), JSON.stringify({
        userName,
        joinedAt: Date.now()
      }))
    }

    await redis.set(`room:${roomId}`, JSON.stringify(room))
    return NextResponse.json({ success: true, room })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
