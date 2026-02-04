'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/solid'

export default function CreateRoomPage() {
  const router = useRouter()
  const [roomName, setRoomName] = useState('')
  const [userName, setUserName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreate = () => {
    const code = generateRoomCode()
    setRoomCode(code)
  }

  const copyToClipboard = () => {
    const url = `${window.location.origin}/join?code=${roomCode}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEnterRoom = async () => {
    if (roomCode && userName) {
      // Odayı API'ye kaydet
      try {
        await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomCode,
            name: roomName
          })
        })
      } catch (error) {
        console.error('Failed to create room:', error)
      }
      
      router.push(`/room/${roomCode}?user=${encodeURIComponent(userName)}&host=true`)
    }
  }

  if (roomCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🎉 Oda Hazır!</h1>
            <p className="text-gray-600">Takım üyelerinizi davet edin</p>
          </div>

          <div className="space-y-6 mb-8">
            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-2xl shadow-lg border-4 border-blue-100">
                <QRCodeSVG
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${roomCode}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="mt-4 text-sm text-gray-500 text-center">
                QR kodu okutarak katılın
              </p>
            </div>

            {/* Join Link */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-2 text-center">Veya bu linki paylaşın</p>
              <div className="bg-white px-4 py-3 rounded-lg border border-blue-300 break-all text-center">
                <p className="text-sm text-blue-600 font-medium">
                  {typeof window !== 'undefined' ? `${window.location.origin}/join?code=${roomCode}` : ''}
                </p>
              </div>
            </div>

            {/* Room Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Oda Adı
                </label>
                <div className="bg-gray-50 px-4 py-3 rounded-xl border-2 border-gray-200">
                  <p className="font-bold text-lg">{roomName}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Oda Kodu
                </label>
                <div className="bg-blue-50 px-4 py-3 rounded-xl border-2 border-blue-200">
                  <p className="font-mono font-bold text-2xl text-blue-600">{roomCode}</p>
                </div>
              </div>

              <button
                onClick={copyToClipboard}
                className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-medium transition-all"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-5 w-5 text-green-500" />
                    Kopyalandı!
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="h-5 w-5" />
                    Linki Kopyala
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adınız (Moderatör)
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Adınızı girin"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
            />
          </div>

          <button
            onClick={handleEnterRoom}
            disabled={!userName}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            Odaya Gir ve Oylamayı Başlat
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎮 Yeni Oda</h1>
          <p className="text-gray-600">Scrum Poker Oylama Odası Oluştur</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Oda Adı
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Örn: Sprint 45 Planning"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
              autoFocus
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={!roomName}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            Oda Oluştur
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 transition-all"
          >
            Geri
          </button>
        </div>
      </motion.div>
    </div>
  )
}
