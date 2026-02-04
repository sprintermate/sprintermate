'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { SparklesIcon, UsersIcon, ChartBarIcon } from '@heroicons/react/24/solid'

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            🎯 Scrum Poker
          </h1>
          <p className="text-2xl text-gray-600 mb-2">
            AI Destekli Story Point Tahmin Sistemi
          </p>
          <p className="text-lg text-gray-500">
            Yapay zeka ile daha doğru tahminler yapın
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="grid md:grid-cols-3 gap-8 mb-16"
        >
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow">
            <SparklesIcon className="h-12 w-12 text-purple-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">AI Destekli Tahmin</h3>
            <p className="text-gray-600">
              Azure DevOps verilerinizden öğrenen yapay zeka ile doğru tahminler
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow">
            <UsersIcon className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Gerçek Zamanlı Oylama</h3>
            <p className="text-gray-600">
              Tüm takım üyeleri aynı anda oy verebilir ve sonuçları görebilir
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow">
            <ChartBarIcon className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Detaylı Analiz</h3>
            <p className="text-gray-600">
              Oy dağılımlarını ve takım konsensüsünü görsel olarak inceleyin
            </p>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col md:flex-row gap-6 justify-center items-center"
        >
          <button
            onClick={() => router.push('/join')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-xl text-xl font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            📱 Odaya Katıl
          </button>

          <button
            onClick={() => router.push('/create-room')}
            className="bg-white text-gray-900 px-12 py-4 rounded-xl text-xl font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all border-2 border-gray-200"
          >
            🎮 Yeni Oda Oluştur
          </button>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-20 bg-white rounded-2xl p-8 shadow-lg max-w-4xl mx-auto"
        >
          <h2 className="text-3xl font-bold text-center mb-8">Nasıl Çalışır?</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 text-blue-600 rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Oda Oluşturun</h3>
                <p className="text-gray-600">
                  Yeni bir oylama odası oluşturun ve takım üyelerinizle QR kodu paylaşın
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-purple-100 text-purple-600 rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">AI Tahmini Alın</h3>
                <p className="text-gray-600">
                  Work item bilgilerini girin, yapay zeka geçmiş verilere dayalı tahmin üretsin
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-green-100 text-green-600 rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Oylama Yapın</h3>
                <p className="text-gray-600">
                  Tüm takım üyeleri Fibonacci serisi ile oylamalarını yapar
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-yellow-100 text-yellow-600 rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Sonuçları Görün</h3>
                <p className="text-gray-600">
                  Gerçek zamanlı olarak oy dağılımlarını inceleyin ve konsensüse varın
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
