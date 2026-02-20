'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  SparklesIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ChartBarIcon
} from '@heroicons/react/24/solid'

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

interface EstimateData {
  estimatedPoints: number
  reasoning: string
  confidence: string
  similarItems: Array<{
    id: string
    title: string
    points: number
    similarity: number
  }>
  riskFactors: string[]
  timeEstimate: string
}

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, '?', '☕']

export default function RoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const roomId = params.roomId as string
  const userName = searchParams.get('user') || 'Anonymous'
  const isHost = searchParams.get('host') === 'true'
  const userId = `${userName}-${Date.now()}`

  const [room, setRoom] = useState<Room | null>(null)
  const [myVote, setMyVote] = useState<number | string | null>(null)
  const [showEstimate, setShowEstimate] = useState(false)
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null)
  const [loading, setLoading] = useState(false)
  const [workItemTitle, setWorkItemTitle] = useState('')
  const [workItemDescription, setWorkItemDescription] = useState('')

  // Polling for room updates (in production, use WebSocket)
  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms?roomId=${roomId}`)
      if (res.ok) {
        const data = await res.json()
        setRoom(data.room)
      }
    } catch (error) {
      console.error('Failed to fetch room:', error)
    }
  }, [roomId])

  useEffect(() => {
    // Odaya ilk girişte katılımcı olarak ekle (oysuz)
    const joinRoom = async () => {
      try {
        const res = await fetch('/api/rooms/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            userId,
            userName,
            points: null
          })
        })
        if (!res.ok) {
          const data = await res.json()
          if (data?.error) {
            alert(data.error)
            router.replace(`/join?code=${roomId}`)
          }
        }
      } catch (e) {
        // ignore
      }
    }
    joinRoom()
    fetchRoom()
    const interval = setInterval(fetchRoom, 1000)
    return () => clearInterval(interval)
  }, [fetchRoom])

  const handleVote = async (points: number | string) => {
    let voteValue: number | null = null
    if (typeof points === 'number') {
      voteValue = points
      setMyVote(points)
    } else if (points === '☕') {
      voteValue = -1
      setMyVote('☕')
    } else if (points === '?') {
      voteValue = -99 // '?' oyu için özel bir değer
      setMyVote('?')
    }
    try {
      const res = await fetch('/api/rooms/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId,
          userName,
          points: voteValue
        })
      })
      if (!res.ok) {
        const data = await res.json()
        if (data?.error) {
          alert(data.error)
        }
      } else {
        await fetchRoom()
      }
    } catch (error) {
      console.error('Failed to vote:', error)
    }
  }

  // Her kullanıcı kendi oyunu sıfırlayabilsin
  const handleResetMyVote = async () => {
    // Eğer mevcut oy kahve molasıysa sıfırlama yapma
    if (myVote === '☕') return
    setMyVote(null)
    try {
      await fetch('/api/rooms/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId,
          userName,
          points: null
        })
      })
      await fetchRoom()
    } catch (error) {
      console.error('Failed to reset my vote:', error)
    }
  }
  const handleReveal = async () => {
    try {
      await fetch('/api/rooms/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          revealed: !room?.revealed
        })
      })
      // Immediately fetch to see the change
      await fetchRoom()
    } catch (error) {
      console.error('Failed to reveal:', error)
    }
  }

  const handleGetEstimate = async () => {
    if (!workItemTitle) return

    setLoading(true)
    setShowEstimate(true)

    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemId: workItemTitle
        })
      })

      if (res.ok) {
        const data = await res.json()
        setEstimateData(data)
      }
    } catch (error) {
      console.error('Failed to get estimate:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setMyVote(null)
    setShowEstimate(false)
    setEstimateData(null)
    setWorkItemTitle('')
    setWorkItemDescription('')
    try {
      await fetch('/api/rooms/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          revealed: false
        })
      })
      // Kahve molasında olanlar hariç tüm oyları sıfırla
      if (room?.votes) {
        for (const vote of room.votes) {
          if (vote.points !== -1) {
            await fetch('/api/rooms/vote', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                userId: vote.userId,
                userName: vote.userName,
                points: null
              })
            })
          }
        }
      }
      fetchRoom()
    } catch (error) {
      console.error('Failed to reset:', error)
    }
  }

  // Calculate vote statistics
  const voteStats = room?.revealed && room.votes.length > 0 ? (() => {
    const validVotes = room.votes.filter((v: Vote) => typeof v.points === 'number' && v.points > 0) as Array<Vote & { points: number }>
    const points = validVotes.map(v => v.points)
    
    const distribution = points.reduce((acc, p) => {
      acc[p] = (acc[p] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    const avg = points.length > 0 ? points.reduce((a, b) => a + b, 0) / points.length : 0
    const sorted = [...points].sort((a, b) => a - b)
    const median = sorted.length > 0 ? 
      sorted.length % 2 === 0 ? 
        (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : 
        sorted[Math.floor(sorted.length / 2)] 
      : 0

    return { distribution, avg, median, total: validVotes.length }
  })() : null

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Oda yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{room.name}</h1>
              <p className="text-gray-600">Oda Kodu: <span className="font-mono font-bold text-blue-600">{room.id}</span></p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl">
                <UserGroupIcon className="h-5 w-5 text-blue-600" />
                <span className="font-bold text-blue-600">{room.votes.length}</span>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-all"
              >
                <ArrowPathIcon className="h-5 w-5" />
                Herkesi Sıfırla
              </button>
            </div>
          </div>

          {/* Katılımcı Durum Özeti */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Katılımcı Durumu</p>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg">
                <span className="text-green-600 font-bold">✓</span>
                <span className="text-green-700 font-medium">Oy verdi / ?</span>
              </div>
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg">
                <span className="text-red-600 font-bold">❌</span>
                <span className="text-red-700 font-medium">Bekliyor</span>
              </div>
              <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-lg">
                <span className="text-orange-600 font-bold">☕</span>
                <span className="text-orange-700 font-medium">Kahve molası</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Work Item & AI Estimate */}
          <div className="lg:col-span-1 space-y-6">
            {/* Work Item Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <SparklesIcon className="h-6 w-6 text-purple-500" />
                AI Tahmin
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work Item ID
                  </label>
                  <input
                    type="text"
                    value={workItemTitle}
                    onChange={(e) => setWorkItemTitle(e.target.value)}
                    placeholder="Örn: 297583"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Azure DevOps Work Item ID'sini girin
                  </p>
                </div>

                <button
                  onClick={handleGetEstimate}
                  disabled={!workItemTitle || loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Analiz ediliyor...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-5 w-5" />
                      AI Tahmini Al
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* AI Estimate Result */}
            <AnimatePresence>
              {showEstimate && estimateData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg p-6 border-2 border-purple-200"
                >
                  <div className="text-center mb-4">
                    <p className="text-sm text-purple-600 font-medium mb-2">AI Tahmini</p>
                    <div className="text-6xl font-bold text-purple-600 mb-2">
                      {estimateData.estimatedPoints}
                      <span className="text-2xl ml-1">SP</span>
                    </div>
                    <div className="inline-block bg-white px-4 py-1 rounded-full mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Güven: <span className="text-purple-600">{estimateData.confidence}</span>
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">💡 Analiz</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {estimateData.reasoning}
                    </p>
                  </div>

                  {estimateData.similarItems.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="font-medium text-blue-800 mb-2 text-sm">📚 Benzer İşler</p>
                      <div className="space-y-1">
                        {estimateData.similarItems.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="text-xs text-blue-700">
                            #{item.id} - {item.points} SP (Benzerlik: %{item.similarity})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Middle Column - Voting */}
          <div className="lg:col-span-2 space-y-6">
            {/* Voting Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-bold mb-4">Oyunuzu Verin</h2>
              
              <div className="grid grid-cols-5 md:grid-cols-9 gap-3">
                {FIBONACCI.map((value) => {
                  // Sadece son seçilen değer highlight olacak
                  const isSelected = myVote === value
                  const numericValue = typeof value === 'number' ? value : null
                  
                  return (
                    <motion.button
                      key={value}
                      onClick={() => handleVote(numericValue || value)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title={value === '☕' ? '☕ Kahve molası - Birazdan geliyorum' : ''}
                      className={`aspect-[3/4] rounded-xl font-bold text-2xl shadow-lg transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-xl scale-105'
                          : value === '☕'
                          ? 'bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 text-orange-600 border-2 border-orange-300'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200'
                      }`}
                    >
                      {value}
                      {value === '☕' && (
                        <div className="text-[8px] mt-0.5 leading-tight"></div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>

            {/* Participants & Votes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserGroupIcon className="h-6 w-6 text-blue-500" />
                  Katılımcılar ({room.votes.length})
                </h2>
                <button
                  onClick={handleReveal}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                >
                  {room.revealed ? (
                    <>
                      <EyeSlashIcon className="h-5 w-5" />
                      Gizle
                    </>
                  ) : (
                    <>
                      <EyeIcon className="h-5 w-5" />
                      Oyları Göster
                    </>
                  )}
                </button>
              </div>

              {/* Oy Dağılımı */}
              {room.revealed && (() => {
                // Oy dağılımı: hem sayısal hem de '?' oylarını dahil et
                const voteCounts: Record<string, number> = {}
                let totalVotes = 0
                room.votes.forEach(vote => {
                  if (typeof vote.points === 'number' && vote.points > 0) {
                    voteCounts[vote.points] = (voteCounts[vote.points] || 0) + 1
                    totalVotes++
                  } else if (vote.points === -99) { // '?' için
                    voteCounts['?'] = (voteCounts['?'] || 0) + 1
                    totalVotes++
                  }
                })
                const sortedPoints = Object.keys(voteCounts).filter(k => k !== '?').map(Number).sort((a, b) => a - b)
                const hasQuestion = typeof voteCounts['?'] !== 'undefined'
                return totalVotes > 0 ? (
                  <div className="mb-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1">
                      <ChartBarIcon className="h-4 w-4" />
                      Oy Dağılımı
                    </h3>
                    <div className="space-y-2">
                      {sortedPoints.map(points => {
                        const count = voteCounts[points]
                        const percentage = ((count / totalVotes) * 100).toFixed(0)
                        return (
                          <div key={points} className="bg-white rounded-md p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-base text-blue-600">{points} SP</span>
                              <div className="text-right">
                                <span className="text-xs font-medium text-gray-900">{count} kişi</span>
                                <span className="text-xs text-gray-500 ml-1">(%{percentage})</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full"
                              />
                            </div>
                          </div>
                        )
                      })}
                      {hasQuestion && (
                        <div className="bg-white rounded-md p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-base text-green-600">? (Bilinmiyor)</span>
                            <div className="text-right">
                              <span className="text-xs font-medium text-gray-900">{voteCounts['?']} kişi</span>
                              <span className="text-xs text-gray-500 ml-1">(%{((voteCounts['?']/totalVotes)*100).toFixed(0)})</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${((voteCounts['?']/totalVotes)*100).toFixed(0)}%` }}
                              transition={{ duration: 0.5, delay: 0.1 }}
                              className="bg-gradient-to-r from-green-400 to-green-600 h-full rounded-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Katılımcı Listesi - Alt alta ince satırlar */}
              <div className="space-y-1">
                {(() => {
                  // Revealed durumda en düşük oy üstte, en yüksek altta
                  const sortedVotes = room.revealed
                    ? [...room.votes].sort((a, b) => {
                        // Kahve molası (-1) en alta
                        if (a.points === -1) return 1
                        if (b.points === -1) return -1
                        // null oylar kahve molasından önce
                        if (a.points === null) return 1
                        if (b.points === null) return -1
                        // Sayısal oyları küçükten büyüğe
                        return a.points - b.points
                      })
                    : room.votes
                  
                  return sortedVotes.map((vote) => {
                    // Renk belirleme
                    // '?' oyu da yeşil gösterilsin
                    const isQuestionMark = vote.points === -99
                    const bgColor = vote.points === -1
                      ? 'bg-orange-50 border-orange-300'
                      : vote.points !== null && vote.points !== -1
                      ? 'bg-green-50 border-green-300'
                      : isQuestionMark
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'

                    const textColor = vote.points === -1
                      ? 'text-orange-900'
                      : vote.points !== null && vote.points !== -1
                      ? 'text-green-900'
                      : isQuestionMark
                      ? 'text-green-900'
                      : 'text-red-900'

                    return (
                      <motion.div
                        key={vote.userId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`border-2 rounded-lg px-4 py-2.5 flex items-center justify-between hover:shadow-md transition-all ${bgColor}`}
                      >
                        <span className={`font-medium ${textColor}`}>{vote.userName}</span>
                        {room.revealed && (
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-blue-600">
                              {vote.points === -1 ? '☕' : vote.points === -99 ? '?' : vote.points ?? '?'}
                            </span>
                            {typeof vote.points === 'number' && vote.points > 0 && (
                              <span className="text-xs text-gray-500">SP</span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )
                  })
                })()}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
