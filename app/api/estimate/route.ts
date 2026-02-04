import { NextRequest, NextResponse } from 'next/server'

// Scrum Poker Agent simülasyonu - Gerçek Azure DevOps entegrasyonu için ayrı bir servis kullanılabilir
interface EstimateRequest {
  workItemId: string
}

interface EstimateResponse {
  estimatedPoints: number
  reasoning: string
  confidence: string
  similarItems: Array<{
    id: string
    title: string
    points: number
    similarity: number
  }>
}

const FIBONACCI_SERIES = [1, 2, 3, 5, 8, 13, 21, 34, 55]

function roundToFibonacci(points: number): number {
  // En yakın Fibonacci sayısını bul
  if (points <= 1) return 1
  if (points >= 55) return 55
  
  for (let i = 0; i < FIBONACCI_SERIES.length - 1; i++) {
    const current = FIBONACCI_SERIES[i]
    const next = FIBONACCI_SERIES[i + 1]
    
    if (points === current) return current
    if (points < next) {
      // Ortaya yakın olanı seç
      return (points - current) < (next - points) ? current : next
    }
  }
  
  return 55
}

// Mock historical data - 55'e kadar SP içeren veriler
const mockHistoricalData = [
  { id: '245671', title: 'Müşteri adres alanı ekleme', points: 5, layers: ['NDAL', 'VCBL', 'Service'], type: 'field-addition' },
  { id: '238912', title: 'Kredi tutarı validasyonu', points: 3, layers: ['VCBL', 'Service'], type: 'validation' },
  { id: '251234', title: 'Ödeme tarihi alanı genişletme', points: 8, layers: ['NDAL', 'VCBL', 'Service', 'UI'], type: 'field-addition' },
  { id: '248156', title: 'Yeni API endpoint ekleme', points: 13, layers: ['NDAL', 'VCBL', 'Service'], type: 'api-endpoint' },
  { id: '252789', title: 'UI bug fix', points: 2, layers: ['UI'], type: 'bug-fix' },
  { id: '247123', title: 'Database migration', points: 5, layers: ['NDAL', 'DB'], type: 'database' },
  { id: '249654', title: 'Yeni rapor ekleme', points: 8, layers: ['Service', 'UI'], type: 'reporting' },
  { id: '250987', title: 'Third-party integration', points: 21, layers: ['NDAL', 'VCBL', 'Service'], type: 'integration' },
  { id: '253456', title: 'Büyük refactoring', points: 34, layers: ['NDAL', 'VCBL', 'Service', 'UI'], type: 'refactoring' },
  { id: '254789', title: 'Yeni modül geliştirme', points: 55, layers: ['NDAL', 'VCBL', 'Service', 'UI', 'DB'], type: 'new-module' },
]

function analyzeWorkItemById(workItemId: string): EstimateResponse {
  // Simüle edilmiş work item analizi
  // Gerçek uygulamada Azure DevOps API'den work item detayları çekilir
  
  // ID'ye göre pattern matching
  const idNum = parseInt(workItemId.replace(/\D/g, '')) || 0
  const complexity = (idNum % 10) + 1
  
  // Benzer işleri bul
  const similarItems = mockHistoricalData
    .filter(item => Math.abs(item.points - complexity * 3) <= 8)
    .sort((a, b) => Math.abs(a.points - complexity * 3) - Math.abs(b.points - complexity * 3))
    .slice(0, 3)
    .map(item => ({
      ...item,
      similarity: Math.floor(70 + Math.random() * 25)
    }))

  let estimatedPoints = 5
  let reasoning = ''
  let confidence = 'Orta'

  if (similarItems.length > 0) {
    const avgPoints = similarItems.reduce((sum, item) => sum + item.points, 0) / similarItems.length
    estimatedPoints = roundToFibonacci(Math.round(avgPoints))
    
    const topMatch = similarItems[0]
    confidence = topMatch.similarity > 85 ? 'Yüksek' : topMatch.similarity > 70 ? 'Orta' : 'Düşük'
    
    reasoning = `${topMatch.layers.length} katman etkileniyor (${topMatch.layers.join(', ')}). `
    reasoning += `Benzer ${similarItems.length} iş bulundu, ortalama ${Math.round(avgPoints)} SP → Fibonacci: ${estimatedPoints} SP. `
    reasoning += `En yakın: #${topMatch.id} (${topMatch.points} SP, %${topMatch.similarity} benzer).`
  } else {
    const rawPoints = Math.min(complexity * 5, 55)
    estimatedPoints = roundToFibonacci(rawPoints)
    reasoning = `Benzersiz iş türü. Karmaşıklık seviyesi ${complexity}/10. `
    reasoning += `Ham tahmin ${rawPoints} SP → Fibonacci: ${estimatedPoints} SP. `
    reasoning += `Detaylı analiz için takım görüşü alınmalı.`
    confidence = 'Düşük'
  }

  return {
    estimatedPoints: roundToFibonacci(Math.min(estimatedPoints, 55)),
    reasoning,
    confidence,
    similarItems: similarItems.map(item => ({
      id: item.id,
      title: item.title,
      points: item.points,
      similarity: item.similarity
    }))
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: EstimateRequest = await request.json()

    if (!body.workItemId) {
      return NextResponse.json(
        { error: 'Work Item ID is required' },
        { status: 400 }
      )
    }

    const estimate = analyzeWorkItemById(body.workItemId)

    return NextResponse.json(estimate)
  } catch (error) {
    console.error('Estimate API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
