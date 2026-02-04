'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QrScannerProps {
  onScan: (result: string) => void
}

export default function QrScanner({ onScan }: QrScannerProps) {
  const [error, setError] = useState<string>('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const hasScannedRef = useRef(false)

  useEffect(() => {
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (!hasScannedRef.current) {
              hasScannedRef.current = true
              
              // QR koddan oda kodunu çıkar
              let roomCode = decodedText
              if (decodedText.includes('?code=')) {
                roomCode = decodedText.split('?code=')[1]
              }
              
              onScan(roomCode)
              
              // Scanner'ı durdur
              scanner.stop().catch(console.error)
            }
          },
          undefined
        )
      } catch (err) {
        console.error('QR Scanner error:', err)
        setError('Kamera erişimi reddedildi veya desteklenmiyor.')
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [onScan])

  return (
    <div className="space-y-4">
      <div id="qr-reader" className="rounded-xl overflow-hidden border-4 border-blue-200"></div>
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}
      <p className="text-sm text-gray-500 text-center">
        QR kodu kamera ile okutun
      </p>
    </div>
  )
}
