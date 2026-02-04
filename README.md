# Scrum Poker - AI Destekli Story Point Tahmin Uygulaması

Modern, gerçek zamanlı Scrum Poker oylama uygulaması. Azure DevOps verilerine dayalı yapay zeka ile story point tahminleri yapabilirsiniz.

## ✨ Özellikler

- 🤖 **AI Destekli Tahmin**: Geçmiş sprint verilerine dayalı akıllı story point tahminleri
- 📱 **QR Kod ile Katılım**: Mobil cihazlardan hızlıca QR kod okutarak odaya katılın
- 👥 **Gerçek Zamanlı Oylama**: Tüm katılımcılar aynı anda oy verebilir
- 📊 **Detaylı Analiz**: Oy dağılımları, ortalama, medyan ve görsel grafikler
- 🎨 **Modern UI**: Tailwind CSS ve Framer Motion ile çok modern arayüz
- ⚡ **Hızlı ve Responsive**: Next.js 14 App Router ile optimize edilmiş performans

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+ 
- npm veya yarn

### Adımlar

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Development sunucusunu başlatın:
```bash
npm run dev
```

3. Tarayıcınızda açın:
```
http://localhost:3000
```

## 📖 Kullanım

### 1. Yeni Oda Oluşturma

1. Ana sayfada "Yeni Oda Oluştur" butonuna tıklayın
2. Oda adını girin (örn: "Sprint 45 Planning")
3. QR kodu oluşturun ve takım üyelerinizle paylaşın
4. Adınızı girin ve odaya girin

### 2. Odaya Katılma

**QR Kod ile:**
1. "QR Kod ile Katıl" butonuna tıklayın
2. Kamera izni verin ve QR kodu okutun
3. Adınızı girin ve katılın

**Manuel olarak:**
1. Oda kodunu girin (örn: ABC123)
2. Adınızı girin ve katılın

### 3. AI Tahmin Alma

1. Oylama odasında sol taraftan "Work Item Başlığı" girin
2. İsteğe bağlı olarak açıklama ekleyin (hangi katmanlar etkilenecek, vb.)
3. "AI Tahmini Al" butonuna tıklayın
4. Yapay zeka, geçmiş verilere dayalı tahmin üretecek

### 4. Oylama

1. Fibonacci serisinden (1, 2, 3, 5, 8, 13, 21) bir puan seçin
2. Tüm katılımcılar oy verdikten sonra moderatör "Oyları Göster" butonuna tıklar
3. Sonuçları görün: Ortalama, medyan, oy dağılımı

### 5. Yeni Oylama

1. Moderatör "Sıfırla" butonuna tıklar
2. Yeni work item için AI tahmini alın
3. Tekrar oylama yapın

## 🏗️ Proje Yapısı

```
ScrumPoker/
├── app/
│   ├── api/
│   │   ├── estimate/        # AI tahmin API'si
│   │   └── rooms/           # Oda yönetimi API'leri
│   ├── join/                # QR kod okutma sayfası
│   ├── create-room/         # Oda oluşturma sayfası
│   ├── room/[roomId]/       # Oylama odası
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Ana sayfa
│   └── globals.css          # Global stiller
├── components/
│   └── QrScanner.tsx        # QR kod okuyucu component
├── .github/
│   └── agents/
│       └── scrum-poker-agent.md  # AI Agent tanımı
└── package.json
```

## 🤖 AI Agent Entegrasyonu

Uygulama, `.github/agents/scrum-poker-agent.md` dosyasında tanımlanan Scrum Poker Agent'ını kullanır.

### ⚠️ Şu Anki Durum: SİMÜLASYON MODU

**Agent şu an DUMMY/MOCK data ile çalışıyor:**
- ✅ Fibonacci serisinden puan veriyor (1, 2, 3, 5, 8, 13, 21, 34, 55)
- ✅ Benzerlik analizi yapıyor
- ✅ Kısa ve öz açıklama üretiyor
- ❌ **GERÇEK Azure DevOps verisi ÇEKMİYOR**

### Nasıl Çalışıyor?

**Simülasyon Mantığı:**
1. Work Item ID'si alınıyor (örn: 297583)
2. ID'den karmaşıklık seviyesi çıkarılıyor
3. 10 adet mock historical data ile karşılaştırılıyor
4. Benzer işlerin ortalaması alınıp **Fibonacci'ye yuvarlanıyor**
5. Sonuç ekrana basılıyor

**Örnek:**
- Girdi: Work Item #250987
- Ham hesaplama: 28 SP
- Fibonacci yuvarlama: **21 SP** veya **34 SP** (yakınlığa göre)
- Çıktı: "21 SP - 3 katman etkileniyor..."

### Gerçek Azure DevOps Entegrasyonu

Production kullanımı için, `/app/api/estimate/route.ts` dosyasını güncelleyerek:

1. **Azure DevOps REST API bağlantısı ekleyin:**
```typescript
const ADO_ORG = process.env.AZURE_DEVOPS_ORG
const ADO_PROJECT = process.env.AZURE_DEVOPS_PROJECT
const ADO_PAT = process.env.AZURE_DEVOPS_PAT

// Work Item detaylarını çek
const response = await fetch(
  `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.0`,
  {
    headers: {
      'Authorization': `Basic ${Buffer.from(`:${ADO_PAT}`).toString('base64')}`
    }
  }
)
```

2. **Son 6 sprint verisini çekin:**
```typescript
// WIQL sorgusu ile historical data
const query = `
  SELECT [System.Id], [System.Title], [Microsoft.VSTS.Scheduling.Effort]
  FROM WorkItems
  WHERE [System.State] = 'Closed'
  AND [Microsoft.VSTS.Scheduling.Effort] > 0
  ORDER BY [System.ChangedDate] DESC
`
```

3. **Environment variables ekleyin:**
```bash
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PROJECT=VDF-FinanceWare
AZURE_DEVOPS_PAT=your-personal-access-token
```

### Agent Kuralları

Agent **kesinlikle** şunları yapar:
- ✅ Sadece Fibonacci serisinden puan verir (1-55 arası)
- ✅ Geçmiş verilere dayalı tahmin yapar
- ✅ Benzer işleri gösterir
- ✅ Kısa açıklama yapar (2-3 cümle)

Agent **asla** şunları yapmaz:
- ❌ Fibonacci dışı puan vermez (28, 17, 40 gibi)
- ❌ Work item oluşturmaz/güncellemez
- ❌ Uzun açıklamalar yapmaz

## 🎨 Özelleştirme

### Renk Teması

`tailwind.config.js` dosyasından renk paletini özelleştirebilirsiniz.

### Fibonacci Serisi

`app/room/[roomId]/page.tsx` dosyasındaki `FIBONACCI` dizisini düzenleyerek oylama kartlarını değiştirebilirsiniz.

### Polling Süresi

`app/room/[roomId]/page.tsx` içinde `setInterval` değerini değiştirerek güncelleme sıklığını ayarlayabilirsiniz.

## 🔧 Production Deployment

### Vercel (Önerilen)

```bash
npm run build
vercel --prod
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Önemli Notlar

- Production'da WebSocket kullanın (Socket.io gibi)
- Oda verilerini Redis veya veritabanında saklayın
- Azure DevOps PAT'i environment variable olarak ekleyin

## 📝 Lisans

Bu proje CoreCredit için geliştirilmiştir.

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing`)
5. Pull Request açın

## 🐛 Bug Raporu

Lütfen GitHub Issues üzerinden bildirin.

## 📧 İletişim

Sorularınız için: [email protected]

---

**Hazırlayan**: GitHub Copilot  
**Versiyon**: 1.0.0  
**Tarih**: 2026
