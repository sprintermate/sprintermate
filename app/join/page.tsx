'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { QrCodeIcon, UserIcon } from '@heroicons/react/24/solid'
import dynamic from 'next/dynamic'

// QR Scanner'ı client-side'da yükle
const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false })

export default function JoinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showScanner, setShowScanner] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [userName, setUserName] = useState('')
  const [step, setStep] = useState(1)

  // URL'den oda kodu geliyorsa otomatik doldur
  useEffect(() => {
    const codeFromUrl = searchParams.get('code')
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase())
      setStep(2)
    }
  }, [searchParams])

  const handleQrScan = (result: string) => {
    // QR koddan veya linkten oda kodunu çıkar
    let code = result
    if (result.includes('?code=')) {
      code = result.split('?code=')[1].split('&')[0]
    } else if (result.includes('/join/')) {
      code = result.split('/join/')[1]
    }
    setRoomCode(code.toUpperCase())
    setShowScanner(false)
    setStep(2)
  }

  const handleJoin = () => {
    if (roomCode && userName) {
      router.push(`/room/${roomCode}?user=${encodeURIComponent(userName)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎯 Katıl</h1>
          <p className="text-gray-600">Scrum Poker Odasına Giriş</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            step >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            1
          </div>
          <div className={`h-1 w-16 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
            step >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
        </div>

        {step === 1 && !showScanner && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Oda Kodu
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Örn: ABC123"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg text-center font-mono"
                maxLength={6}
              />
            </div>

            <button
              onClick={() => setShowScanner(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <QrCodeIcon className="h-6 w-6" />
              QR Kod Okut
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">veya</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (roomCode) setStep(2)
              }}
              disabled={!roomCode}
              className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Devam Et
            </button>
          </motion.div>
        )}

        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <QrScanner onScan={handleQrScan} />
            <button
              onClick={() => setShowScanner(false)}
              className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 transition-all"
            >
              İptal
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Oda Kodu</p>
              <p className="text-2xl font-bold text-blue-600 font-mono">{roomCode}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adınız
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Adınızı girin"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-4 rounded-xl font-bold hover:bg-gray-300 transition-all"
              >
                Geri
              </button>
              <button
                onClick={handleJoin}
                disabled={!userName}
                className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Katıl
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
