# 🏃 Sprintermate — Proje Dokümantasyonu

> **AI destekli gerçek zamanlı Planning Poker, Retrospektif ve Sprint Analitik platformu.**
> Azure DevOps entegrasyonu ile Scrum takımlarının tahminleme, retrospektif ve sprint sağlığı süreçlerini akıllı hale getirir.

---

## 📑 İçindekiler

1. [Proje Özeti](#-proje-özeti)
2. [Projenin Amacı ve Çözdüğü Problem](#-projenin-amacı-ve-çözdüğü-problem)
3. [Kullanıcı Rolleri ve Giriş Akışı](#-kullanıcı-rolleri-ve-giriş-akışı)
4. [Uçtan Uca İş Akışı](#-uçtan-uca-iş-akışı)
5. [Ana Özellikler](#-ana-özellikler)
   - [Proje ve Sprint Yönetimi](#1-proje-ve-sprint-yönetimi)
   - [Planning Poker Odası](#2-planning-poker-odası-gerçek-zamanlı-oylama)
   - [🤖 AI Story Point Tahmini](#3--ai-story-point-tahmini)
   - [🤖 AI Puanlamayı Etkileyen Faktörler](#4--ai-puanlamayı-etkileyen-faktörler-detaylı)
   - [Retrospektif Board](#5-retrospektif-board)
   - [🤖 AI Retrospektif Analizi](#6--ai-retrospektif-analizi)
   - [Sprint Metrikleri ve Dashboard](#7-sprint-metrikleri-ve-dashboard)
   - [🤖 AI Sprint İçgörüleri](#8--ai-sprint-içgörüleri)
6. [Azure DevOps Entegrasyonu](#-azure-devops-entegrasyonu)
7. [Teknik Mimari](#-teknik-mimari)
8. [Ortam Değişkenleri](#-ortam-değişkenleri)

---

## 🎯 Proje Özeti

**Sprintermate**, Scrum takımlarının günlük ihtiyaçlarını tek bir platformda karşılayan, üç ana modülden oluşan bir uygulamadır:

| Modül | Açıklama | AI Desteği |
|-------|----------|:----------:|
| **Planning Poker** | Gerçek zamanlı story point tahminleme odası | ✅ AI otomatik tahmin |
| **Retrospektif** | 3 sütunlu retro board (İyi Giden / Geliştirilecek / Fikirler) | ✅ AI trend analizi + aksiyon önerisi |
| **Sprint Metrikleri** | Velocity, cycle time, flow efficiency dashboard | ✅ AI yönetici içgörüleri |

**Teknoloji:** Express + TypeScript + Socket.IO + SQLite (backend) · Next.js 14 + Tailwind CSS (frontend) · Electron 31 (masaüstü) · Docker (deployment)

**Dil Desteği:** Türkçe 🇹🇷 ve İngilizce 🇬🇧 (AI çıktıları dahil)

---

## 🧩 Projenin Amacı ve Çözdüğü Problem

### Problem

Scrum takımları sprint planlama toplantılarında story point tahminlemesi yaparken:

- **Subjektif tahminler** farklı deneyim seviyelerindeki geliştiriciler arasında tutarsızlık yaratır
- **Geçmiş verilerin unutulması** — önceki sprintlerde benzer işlere kaç puan verildiği hatırlanmaz
- **Retrospektifler verimsiz geçer** — aynı sorunlar tekrarlanır, aksiyonlar takip edilmez
- **Sprint sağlığı görünmez** — velocity düşüşleri, bottleneck'ler ancak sprint bittiğinde fark edilir
- **Dağıtık takımlar** fiziksel planning poker oynayamaz

### Çözüm

Sprintermate bu sorunları şu şekilde çözer:

1. **Gerçek zamanlı Planning Poker** — bağlantı linki paylaşarak herkes (misafirler dahil) katılabilir
2. **AI destekli tahmin** — her iş öğesi için AI, geçmiş sprint verilerini ve referans skorları kullanarak kalibrasyon destekli tahmin üretir
3. **Akıllı retrospektif** — AI önceki sprintlerdeki aksiyonlarla karşılaştırma yaparak trend analizi çıkarır
4. **Canlı metrikler** — Azure DevOps'tan çekilen verilerle sprint sağlığı anlık görüntülenir
5. **AI vs İnsan karşılaştırması** — zamanla AI tahminlerinin ekip tahminleriyle ne kadar örtüştüğü ölçülür

---

## 👥 Kullanıcı Rolleri ve Giriş Akışı

### Kayıtlı Kullanıcı

```
Email + Şifre → bcrypt hash (12 round) → JWT token (httpOnly cookie, 7 gün) → Dashboard
```

- Proje oluşturabilir, oda/retro açabilir, AI ayarlarını yapılandırabilir
- Sprint metriklerini görüntüleyebilir

### Misafir Kullanıcı

```
İsim gir (2-63 karakter) → Rastgele UUID atanır → Doğrudan odaya/retro'ya katıl
```

- Hesap gerektirmez — sadece oda kodunu ve ismini bilmesi yeterli
- Oy verebilir, retro'ya post-it ekleyebilir
- Moderatör tarafından "delegated moderator" yapılabilir

### Moderatör (Oda Sahibi)

- Odayı oluşturan kişi otomatik moderatör olur
- **Yetkileri:** İş öğesine navigate etme, oylamayı başlatma/açma, puanı Azure DevOps'a kaydetme, AI tahmini tetikleme, yorum ekleme
- Bir katılımcıya geçici moderatörlük verebilir (**delegated moderator**)

### Delegated Moderator

- Ana moderatör tarafından atanır, yine ana moderatör tarafından geri alınabilir
- Aynı moderatör yetkilerine sahiptir (puan kaydetme, reveal, AI tahmini vb.)
- Socket üzerinden `work:save_score` ile puan kaydedebilir

---

## 🔄 Uçtan Uca İş Akışı

### Akış 1: Planning Poker Seansı

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PLANLAMA POKER AKIŞI                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. HAZIRLIK                                                        │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐              │
│  │ Proje    │───▶│ ADO URL      │───▶│ PAT           │              │
│  │ Oluştur  │    │ Parse Et     │    │ Doğrula +     │              │
│  │          │    │ (org/proje/  │    │ Şifrele       │              │
│  │          │    │  team çıkar) │    │ (AES-256-GCM) │              │
│  └──────────┘    └──────────────┘    └───────┬───────┘              │
│                                              │                      │
│  2. ODA KURULUMU                             ▼                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐              │
│  │ Sprint   │───▶│ Referans     │───▶│ Oda Oluştur   │              │
│  │ Seç      │    │ Skorları     │    │ (6 haneli     │              │
│  │ (ADO'dan │    │ Belirle      │    │  hex kod)     │              │
│  │  çekilir)│    │ (kalibrasyon)│    │               │              │
│  └──────────┘    └──────────────┘    └───────┬───────┘              │
│                                              │                      │
│  3. OYLAMA SEANSI                            ▼                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐              │
│  │ Linki    │───▶│ Katılımcılar │───▶│ İş Öğesine    │              │
│  │ Paylaş   │    │ Katılır      │    │ Navigate Et   │              │
│  │          │    │ (Socket.IO)  │    │ (moderatör)   │              │
│  └──────────┘    └──────────────┘    └───────┬───────┘              │
│                                              │                      │
│                                              ▼                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐              │
│  │ Puan     │◀──▶│ 🤖 AI Tahmin │    │ Oylamayı      │              │
│  │ Kaydet   │    │ (otomatik    │    │ Başlat        │              │
│  │ (ADO'ya) │    │  tetiklenir) │    │               │              │
│  └──────────┘    └──────────────┘    └───────┬───────┘              │
│       ▲                                      │                      │
│       │          ┌──────────────┐    ┌───────▼───────┐              │
│       │          │ İstatistik   │◀───│ Herkes Oy     │              │
│       └──────────│ Göster       │    │ Verir         │              │
│                  │ (ort/median/ │    │ (1-55, ?, ☕) │              │
│                  │  min/max)    │    └───────┬───────┘              │
│                  └──────────────┘            │                      │
│                         ▲            ┌──────▼────────┐              │
│                         └────────────│ Oyları Aç     │              │
│                                      │ (Reveal)      │              │
│                                      └───────────────┘              │
│                                                                     │
│  4. SONRAKI İŞ ÖĞESİ → 3. adıma dön                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Akış 2: Retrospektif Seansı

```
┌───────────────────────────────────────────────────────────────┐
│                   RETROSPEKTİF AKIŞI                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │ Retro      │──▶│ Katılımcılar │──▶│ Post-it Yaz        │  │
│  │ Oluştur    │   │ Katılır      │   │ (3 sütun:          │  │
│  │ (başlık +  │   │ (kod ile)    │   │  ✓İyi / △Geliştir  │  │
│  │  süre)     │   │              │   │  / 💡Fikir)        │  │
│  └────────────┘   └──────────────┘   └─────────┬──────────┘  │
│                                                │              │
│                                                ▼              │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │ Aksiyonları│◀──│ 🤖 AI Analiz │◀──│ Oylama             │  │
│  │ Kabul Et / │   │ (trend +     │   │ (👍/👎 her item'a) │  │
│  │ Reddet     │   │  aksiyon     │   │                    │  │
│  │ + Manuel   │   │  önerisi)    │   │                    │  │
│  │   Ekle     │   │              │   │                    │  │
│  └─────┬──────┘   └──────────────┘   └────────────────────┘  │
│        │                                                      │
│        ▼                                                      │
│  ┌────────────────────────────────────┐                       │
│  │ Retro Kapanır → Aksiyonlar Kaydedilir                     │
│  │ (Bir sonraki retro'da trend analizi için kullanılır)       │
│  └────────────────────────────────────┘                       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 🛠 Ana Özellikler

### 1. Proje ve Sprint Yönetimi

| Özellik | Açıklama |
|---------|----------|
| **ADO URL Parse** | Azure DevOps board URL'sinden organizasyon, proje, takım ve sprint bilgilerini otomatik çıkarır. Hem `dev.azure.com` hem `*.visualstudio.com` formatını destekler |
| **PAT Yönetimi** | Personal Access Token AES-256-GCM ile şifrelenerek veritabanında saklanır. Hiçbir zaman düz metin olarak tutulmaz |
| **PAT Doğrulama** | Token'ın geçerliliği ADO profil endpoint'i üzerinden anlık kontrol edilir |
| **Sprint Önbellekleme** | İlk çekmede ADO'dan alınan sprintler veritabanına kaydedilir — sonraki isteklerde hızlı erişim |
| **Referans Skorlar** | Proje bazında "kalibrasyon çıpaları" tanımlama (ör. "Basit bug fix → 2 puan", "API entegrasyonu → 13 puan"). AI tahminlerini kalibre etmek için kullanılır |

### 2. Planning Poker Odası (Gerçek Zamanlı Oylama)

**Oda Oluşturma:**
- 6 haneli benzersiz hex kod üretilir (ör. `3F2A5B`)
- Proje + Sprint seçimi zorunlu
- Oda linki paylaşılarak herkes katılabilir

**Oylama Mekaniği:**

| Değer | Anlamı |
|-------|--------|
| `1, 2, 3, 5, 8, 13, 21, 34, 55` | Fibonacci ölçeğinde story point |
| `?` (SCORE_UNDECIDED = -1) | Kararsız — yeterli bilgi yok |
| `☕` (SCORE_COFFEE = -2) | Kahve molası — bu iş öğesiyle ilgilenmiyorum |

**Gerçek Zamanlı Socket.IO Olayları:**

| Olay | Tetikleyen | Açıklama |
|------|-----------|----------|
| `room:join` | Herkes | Odaya katılım. Eski socket bağlantıları temizlenir, mevcut AI tahminleri yüklenir |
| `session:navigate` | Moderatör | Tüm katılımcıları bir iş öğesine yönlendirir. Oylar sıfırlanır, kahve molaları korunur |
| `session:start_scoring` | Moderatör | Oylama turu başlar. Kahve molası oyları geri yüklenir, kaydedilmiş AI tahmini yüklenir |
| `vote:cast` | Herkes | Oy verilir. Açılmamışsa sadece "oy verdi" görünür, puan gizli kalır |
| `vote:reveal` | Moderatör | Tüm oylar açılır. İstatistikler hesaplanır. **Moderatör AI tahminini hemen görür** |
| `vote:revealed` | Sistem | Tüm katılımcılara oylar + istatistikler + AI tahmini broadcast edilir |
| `round:reset` | Moderatör | Aynı iş öğesinde kalarak oyları sıfırlar |
| `session:reset` | Moderatör | İş öğesi listesine geri döner |
| `work:save_score` | Moderatör | Story point'i Azure DevOps'a kaydeder + `WorkItemScoreRecord` oluşturur |

**İstatistik Hesaplamaları (Reveal sonrası):**
- **Ortalama** (average) — ?, ☕ hariç
- **Medyan** (median)
- **Minimum** ve **Maksimum**
- **Oy dağılım çubuğu** — her Fibonacci değerine kaç kişi oy verdiğinin histogramı

**Ek Özellikler:**
- Moderatör devri (grant/revoke)
- ADO'ya yorum ekleme
- İlerleme çubuğu (tamamlanan iş öğeleri yüzdesi)
- Çoklu sekme/yeniden bağlanma desteği (stale socket eviction)

---

### 3. 🤖 AI Story Point Tahmini

Sprintermate'in en güçlü özelliği, her iş öğesi için **bağlam-duyarlı, kalibrasyon destekli** AI tahminleri üretmesidir.

#### Desteklenen AI Sağlayıcıları

| Sağlayıcı | Tür | API Key Gerekli | Model | Notlar |
|-----------|-----|:----------------:|-------|--------|
| **GitHub Copilot** | CLI | ❌ | gpt-4.1 | `copilot` komutu PATH'te olmalı |
| **Claude** | CLI | ❌ | — | `claude --print` ile çalışır |
| **Codex** | CLI | ❌ | — | stdin üzerinden prompt alır |
| **Gemini** | API | ✅ | gemini-2.5-flash-lite (prod) / gemini-flash-latest (dev) | **Production'da zorunlu sağlayıcı** |
| **ChatGPT** | API | ✅ | gpt-4o-mini | OpenAI SDK kullanır |

> **Not:** Production ortamında otomatik olarak Gemini kullanılır (`GEMINI_API_KEY` env var). Development'ta her kullanıcı kendi sağlayıcısını seçebilir.

#### Tahmin Akışı (Tekli)

```
1. Kullanıcı "Start Scoring" butonuna basar
         │
         ▼
2. Work item kilitlenir (estimatingLock Map — çift tahmin önleme)
         │
         ▼
3. Bağlam yüklenir:
   ├── Referans skorlar (proje bazlı kalibrasyon örnekleri)
   ├── Önceki sprint iş öğeleri (son 5-10 sprint, sadece puanlı olanlar)
   └── İş öğesi detayları (başlık, tip, durum, açıklama, kabul kriterleri)
         │
         ▼
4. buildEstimationPrompt() ile prompt oluşturulur
         │
         ▼
5. callAI(provider, apiKey, prompt) ile AI çağrılır
         │
         ▼
6. extractJSON(raw) ile yanıt parse edilir
   ├── Markdown code fence temizleme
   ├── Alternatif key isimleri (story-point, story_point, storyPoint)
   ├── Fibonacci doğrulama (pozitif ve geçerli Fibonacci sayısı)
   └── similar-items filtresi (benzerlik ≥ %70)
         │
         ▼
7. WorkItemAIEstimate tablosuna upsert (atomic UPDATE → INSERT)
         │
         ▼
8. Kilit kaldırılır, sonuç frontend'e döner
   ├── Moderatör: Hemen görür
   └── Diğer katılımcılar: vote:revealed sonrası görür
```

#### Toplu Tahmin Akışı (Estimate All)

```
1. POST /api/ai/estimate-all → Hemen cevap: { queued: N, skipped: M }
         │
         ▼
2. Arka planda asenkron işlem başlar:
   ├── Tüm sprint iş öğeleri ADO'dan çekilir
   ├── Zaten tahmin edilmiş ve kilitli olanlar atlanır
   ├── Referans skorlar + önceki sprint bağlamı BİR KERE yüklenir
   └── 3'lü paralel batch'ler halinde işlenir
         │
     Her item için:
         ├── ai:estimate_start (Socket.IO) → UI'da "tahmin ediliyor" göstergesi
         ├── Prompt oluştur → AI çağır → Parse et → Kaydet
         ├── ai:estimate_complete (Socket.IO) → UI güncellenir
         └── Hata durumunda: ai:estimate_error
         │
         ▼
3. ai:estimate_all_complete → Tüm tahminler tamamlandı
4. İptal: POST /api/ai/estimate-all/cancel ile durdurulabilir
```

#### AI Yanıt Formatı

```json
{
  "story-point": 8,
  "confidence": "high",
  "analysis": "Bu iş öğesi mevcut ödeme API'sine yeni bir ödeme yöntemi 
               entegrasyonu gerektiriyor. Veritabanı şema değişikliği, 
               3. parti API entegrasyonu ve kapsamlı test ihtiyacı göz 
               önüne alındığında orta-yüksek karmaşıklıkta. Önceki 
               sprintteki benzer API entegrasyonu 13 puan almış ancak 
               bu daha dar kapsamlı.",
  "similar-items": [
    {
      "url": "https://dev.azure.com/org/project/_workitems/edit/1234",
      "title": "Payment Gateway API Integration",
      "storyPoints": 13,
      "similarity": 85
    },
    {
      "url": "https://dev.azure.com/org/project/_workitems/edit/1189",
      "title": "Stripe Webhook Handler",
      "storyPoints": 5,
      "similarity": 72
    }
  ]
}
```

**Güven Seviyeleri:**
- 🟢 **high** — AI çok emin (güçlü referans eşleşmesi ve net gereksinimler)
- 🟡 **medium** — Makul güven (bazı belirsizlikler var)
- 🔴 **low** — Belirsiz (eksik bilgi, belirsiz kapsam)

---

### 4. 🤖 AI Puanlamayı Etkileyen Faktörler (Detaylı)

AI'ın story point tahmini üretirken değerlendirdiği faktörler, prompt'un yapısından ve talimatlarından kaynaklanır. İşte **tüm faktörler** ve nasıl kullanıldıkları:

#### Faktör 1: Referans Skorlar (Kalibrasyon Çıpaları) ⚓

```
## Reference Work Items (calibration anchors)
- "Login sayfası tasarımı" — Basit UI değişikliği → 2 story points
- "Ödeme API entegrasyonu" — 3. parti entegrasyon + DB şema → 13 story points
- "Performans optimizasyonu" — Profiling + cache → 8 story points
```

**Nasıl çalışır:**
- Ekip, proje oluşturulurken veya oda açılırken **örnek iş öğeleri + puanlar** tanımlar
- Bu örnekler AI'a "bu takımda 5 puan şu büyüklükteki işe denk gelir" bilgisini verir
- **En kritik faktör** — AI tahminlerini takımın puanlama kültürüne kalibre eder
- Puanlarına göre sıralı olarak prompt'a eklenir

> 💡 **İpucu:** Ne kadar çeşitli ve doğru referans skor girerseniz, AI tahminleri o kadar tutarlı olur.

#### Faktör 2: Önceki Sprint İş Öğeleri (Tarihsel Bağlam) 📊

```
## Previous Sprint Work Items (for context)
- "Implement payment API" → 13 story points
  URL: https://dev.azure.com/...
  Description: REST API endpoint for payment processing...
```

**Nasıl çalışır:**
- Son 5-10 sprintten, **sadece story point'i olan** iş öğeleri alınır
- Her birinin başlığı, puanı, açıklaması (ilk 300 karakter) ve ADO URL'si verilir
- AI bu öğeleri **benzerlik karşılaştırması** için kullanır
- Yanıtta `similar-items` olarak en benzer 5 öğeyi (benzerlik ≥ %70) listeler

#### Faktör 3: İş Öğesi Tipi (Work Item Type) 🏷️

```
Type: Bug / Feature / Task / User Story / Epic
```

**Etkisi:**
- **Bug** genellikle daha düşük puan alır (tanımlı sorun, dar kapsam)
- **Feature/Epic** genellikle daha yüksek puan alır (geniş kapsam, belirsizlik)
- **Task** genellikle teknik ve spesifiktir
- AI, tip bilgisini karmaşıklık değerlendirmesinde ağırlık faktörü olarak kullanır

#### Faktör 4: Açıklama (Description) 📝

```
Description: [HTML temizlenmiş, ilk 800 karakter]
```

**Etkisi:**
- En detaylı bağlam kaynağı — ne yapılacağını anlatır
- HTML etiketleri `stripHtml()` ile temizlenir (`<div>`, `&nbsp;`, `&amp;` vb.)
- **800 karakter sınırı** — token ekonomisi için optimize edilmiş
- Açıklama yoksa `"No description"` gönderilir → AI güven seviyesini düşürür
- **Detaylı açıklama = daha yüksek güven (confidence)**

#### Faktör 5: Kabul Kriterleri (Acceptance Criteria) ✅

```
Acceptance Criteria: [HTML temizlenmiş, ilk 800 karakter]
```

**Etkisi:**
- "Bitti" tanımını belirler — test senaryolarını, edge case'leri, entegrasyon noktalarını gösterir
- Çok maddelik kabul kriterleri → daha yüksek puan (daha fazla iş)
- Kabul kriterleri yoksa prompt'a eklenmez → AI belirsizlik nedeniyle güveni düşürür
- **Kapsam büyüklüğünün en net göstergesi**

#### Faktör 6: Karmaşıklık Analizi (AI Talimatları) 🧠

AI'a verilen analiz talimatları:

```
Analyze complexity, scope, affected services, DB changes, 
testing needs, and similarities to past items.
```

AI bu talimatla açıklama ve kabul kriterlerinden şunları çıkarır:

| Alt Faktör | Yüksek Puan Etkisi | Düşük Puan Etkisi |
|-----------|-------------------|-------------------|
| **Karmaşıklık** | Çoklu servisler, karmaşık iş mantığı | Tek bir değişiklik |
| **Kapsam** | Geniş etki alanı, çok sayıda dosya | İzole değişiklik |
| **Etkilenen servisler** | Frontend + Backend + DB | Sadece UI |
| **DB değişiklikleri** | Şema migration, yeni tablolar | Değişiklik yok |
| **Test ihtiyaçları** | Entegrasyon + e2e + edge case | Basit unit test |
| **Benzerlik** | Önceki yüksek puanlı itemlara benzer | Önceki düşük puanlı itemlara benzer |

#### Faktör 7: Dil / Lokalizasyon 🌍

```
Write all text fields in Turkish.  // veya English
```

- `locale` parametresine göre AI analiz metnini Türkçe veya İngilizce yazar
- Fibonacci sayıları evrenseldir — dil puanlamayı etkilemez
- Ancak **analiz kalitesi** genellikle İngilizce'de daha iyi olur (modellerin eğitim verisi)

#### Faktörler Arası Etkileşim Özeti

```
                    ┌──────────────────┐
                    │   FİNAL TAHMİN   │
                    │  (Fibonacci SP)  │
                    └────────▲─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼─────┐ ┌──────▼───────┐
     │  Referans     │ │ Önceki   │ │ İş Öğesi     │
     │  Skorlar      │ │ Sprint   │ │ Detayları    │
     │  (kalibrasyon)│ │ Öğeleri  │ │              │
     │               │ │(benzerlik│ │  ┌─────────┐ │
     │ "Bu takımda   │ │ analizi) │ │  │ Tip     │ │
     │  5 puan =     │ │          │ │  │ Açıklama│ │
     │  bu kadar iş" │ │          │ │  │ Kabul K.│ │
     │               │ │          │ │  │ Durum   │ │
     └───────────────┘ └──────────┘ │  └─────────┘ │
                                    └──────────────┘
```

**Ağırlık sırası (gözlemlenen davranış):**
1. 🥇 **Referans skorlar** — en güçlü kalibrasyon etkisi
2. 🥈 **Önceki sprint benzerliği** — benzer iş = benzer puan
3. 🥉 **Kabul kriterleri + Açıklama** — kapsam büyüklüğü
4. 🏅 **İş öğesi tipi** — genel karmaşıklık sinyali

---

### 5. Retrospektif Board

**3 Sütunlu Kanban Tarzı Board:**

| Sütun | Emoji | Amaç |
|-------|:-----:|-------|
| **What Went Well** | ✓ | Sprintte iyi giden şeyler |
| **What Could Be Improved** | △ | Geliştirilmesi gereken alanlar |
| **Ideas** | 💡 | Gelecek sprint için fikirler |

**Özellikler:**
- **Gerçek zamanlı** — herkes anlık olarak eklenen post-it'leri görür (Socket.IO)
- **Oylama** — her item'a 👍 (beğen) veya 👎 (beğenme) verilebilir (kişi başına 1 oy)
- **Zamanlayıcı** — moderatör ayarlanabilir süre başlatabilir/duraklatabilir (15/20/30/45/60 dk)
- **Katılımcı listesi** — çevrimiçi kullanıcılar görünür
- **Tema desteği** — karanlık/aydınlık mod
- **Silme** — yazar veya moderatör kendi item'ını silebilir
- **Misafir desteği** — hesapsız katılım

---

### 6. 🤖 AI Retrospektif Analizi

Moderatör "AI Analiz" butonuna bastığında tetiklenir. Takımın yazdığı tüm post-it'leri ve önceki sprint aksiyonlarını analiz eder.

#### AI'ın Karakteri

> *"Takımı gerçekten önemseyen, sıcak, cesaretlendirici ve zaman zaman esprili bir Agile koç"*

#### Prompt'a Giren Veriler

1. **Bu Sprintin Post-it'leri** — 3 kategoriye ayrılmış
2. **Önceki Sprintlerin Aksiyonları** — ekibin daha önce taahhüt ettiği aksiyon maddeleri

#### AI Çıktısı

| Alan | Açıklama |
|------|----------|
| **summary** | 2-3 eğlenceli, akılda kalıcı cümle — sprintin hikayesini anlatır |
| **trend_analysis** | Önceki aksiyonlarla karşılaştırma: ✅ İyileşen · 🔁 Tekrarlayan · 🆕 Yeni sorunlar |
| **actions** | 3-7 somut, spesifik aksiyon önerisi — NE yapılacak ve NASIL yapılacak |

#### Trend Analizi Detayı

```
✅ İYİLEŞEN: "Kod review süresi azaltılsın" aksiyonu işe yaramış —
   bu sprint "hızlı review'lar" iyi giden olarak belirtilmiş.

🔁 TEKRARLAYAN: "Eksik test coverage" hâlâ geliştirilecek sütununda —
   3. sprint üst üste aynı sorun.

🆕 YENİ: "Deployment pipeline yavaşlığı" ilk kez ortaya çıkmış.
```

#### Aksiyon Yönetimi

1. AI önerileri listelenir
2. Moderatör her öneriye ✅ kabul veya ❌ red işareti koyar
3. Manuel aksiyon da eklenebilir
4. "Kaydet" → retro kapanır, aksiyonlar saklanır
5. Bu aksiyonlar **bir sonraki retro'da** trend analizi için kullanılır

---

### 7. Sprint Metrikleri ve Dashboard

Kapsamlı bir sprint sağlığı dashboard'u sunar. Tüm veriler Azure DevOps REST API'sinden çekilir.

#### Sprint Sağlık Skoru (0-100)

```
Sağlık Skoru = (%40 × Tamamlanma Oranı) 
             + (%30 × Velocity Performansı) 
             + (%20 × Bug Ters Oranı) 
             + (%10 × Flow Verimliliği)
```

| Risk Seviyesi | Skor Aralığı |
|:-------------:|:------------:|
| 🟢 Düşük | 70-100 |
| 🟡 Orta | 50-69 |
| 🔴 Yüksek | 0-49 |

#### Metrik Bölümleri

| Bölüm | Metrikler |
|-------|-----------|
| **Tamamlanma Oranı** | Donut chart — "Dev Done veya sonrası" eşiği |
| **Velocity & Kapasite** | Planlanan vs gerçekleşen SP, kapasite kullanım %, takım büyüklüğü/sprint gün/izin girişleri |
| **Velocity Trend** | Son 6 sprint çizgi grafiği |
| **AI vs Takım Skor Karşılaştırması** | AI tahmini vs kullanıcı oylama bar chart |
| **İş Öğesi Dağılımı** | Tip bazında yüzdelik dağılım (Feature, Bug, Task vb.) |
| **Flow & Cycle Time** | Ortalama cycle time, lead time, state geçişleri, dev→test süreleri |

#### Flow Metrikleri (Lean/Kanban tarzı)

| Metrik | Hesaplama | Anlamı |
|--------|-----------|--------|
| **Cycle Time** | İlk ACTIVE durumu → İlk DONE durumu | Geliştirme hızı |
| **Lead Time** | Created tarihi → İlk DONE durumu | Uçtan uca teslimat |
| **Blocked Time** | Durum geçmişinden hesaplanan blokaj süresi | Engeller |
| **WIP Count** | Şu anda "In Progress" durumundaki öğeler | Eş zamanlı iş yükü |
| **Flow Efficiency** | (Değer üreten süre / Lead time) × 100 | Süreç verimliliği |

**Durum geçişi analizi** — her iş öğesinin ADO revizyon geçmişinden (max 50 revizyon):
- Development → Dev Done süresi
- Dev Done → Test süresi
- Test → UAT süresi
- Her durumda ortalama kalma süresi

#### Durum Sınıflandırma Kuralları

| Kategori | Durumlar |
|----------|----------|
| ✅ Tamamlanmış | Done, Closed, Resolved, Completed, Development Done, Test, UAT, Deployed, Released, Accepted |
| 🔄 Devam Eden | Active, In Progress, Committed, Doing, Development |
| ⬜ Başlanmamış | New, To Do, Proposed, Approved, Ready, Backlog, Open |
| ❌ Kaldırılmış | Removed, Cancelled, Cut |

---

### 8. 🤖 AI Sprint İçgörüleri

Sprint metrik dashboard'unda "AI Insights" butonuyla tetiklenir. Mevcut sprint metriklerini ve tarihsel trend verilerini analiz ederek yönetici seviyesinde içgörüler üretir.

#### AI'a Gönderilen Veri

```
CURRENT SPRINT: Sprint 23
Health Score: 72/100
Completion Rate: 78%
Velocity: 45 points (Planned: 55)
Scope Change: 12%
Risk Level: medium
Avg Cycle Time: 4.2 days
Avg Lead Time: 8.1 days
Blocked Time: 1.3 days

Historical data from 5 previous sprints:
Sprint 22: Velocity 42, Completion 75%, Bugs 8
Sprint 21: Velocity 50, Completion 82%, Bugs 5
...
```

#### AI Çıktısı

| Alan | Açıklama |
|------|----------|
| **summary** | 2-3 cümlelik yönetici özeti |
| **risks** | Tespit edilen riskler listesi |
| **recommendations** | İyileştirme önerileri |
| **strengths** | Takımın güçlü yanları |
| **velocityTrend** | Velocity trend analizi |
| **qualityTrend** | Kalite trend analizi |
| **flowHealth** | Flow sağlığı değerlendirmesi |
| **teamCapacity** | Kapasite kullanım analizi |

#### Fallback Kural Motoru

AI sağlayıcısı başarısız olduğunda **kural tabanlı analiz** devreye girer:

| Koşul | Sonuç |
|-------|-------|
| Tamamlanma < %60 | ⚠️ Risk: "Sprint kapsamı çok agresif olabilir" |
| Tamamlanma > %90 | ✅ Güçlü yan: "Mükemmel tamamlanma oranı" |
| Velocity düşüyor (son 3 sprint) | ⚠️ Risk: "Velocity düşüş trendinde" |
| Velocity artıyor | ✅ Güçlü yan: "Velocity iyileşme trendinde" |
| Cycle time > 10 gün | ⚠️ Risk: "Yüksek cycle time, bottleneck olabilir" |
| Cycle time < 3 gün | ✅ Güçlü yan: "Hızlı cycle time, verimli teslimat" |
| Kapasite > %90 | 💡 "Sürdürülebilirse kapsam artışı düşünülebilir" |
| Kapasite < %50 | ⚠️ "Düşük kullanım — engelleri ve kapsam doğruluğunu gözden geçirin" |

---

## 🔗 Azure DevOps Entegrasyonu

### Desteklenen URL Formatları

```
https://dev.azure.com/{org}/{project}/_sprints/...
https://{org}.visualstudio.com/{project}/_sprints/...
https://dev.azure.com/{org}/{project}/_boards/...
```

### API İşlemleri

| İşlem | Amaç |
|-------|-------|
| **PAT Doğrulama** | `GET /_apis/profile/profiles/me` → token geçerli mi? |
| **Sprint Listeleme** | `GET /{project}/{team}/_apis/work/teamsettings/iterations` |
| **İş Öğesi Çekme** | 2 adımlı: ID listesi çekme → batch detay çekme (200'er) |
| **Detay Çekme** | Başlık, tip, durum, açıklama, kabul kriterleri, atanan kişi, story point |
| **Story Point Güncelleme** | `PATCH /_apis/wit/workitems/{id}` (JSON-Patch) |
| **Yorum Ekleme** | `POST /_apis/wit/workitems/{id}/comments` |
| **Revizyon Geçmişi** | `GET /_apis/wit/workitems/{id}/revisions` (max 50, metrikler için) |

### Güvenlik

- **PAT Şifreleme:** AES-256-GCM ile şifrelenir, sadece kullanım anında çözülür
- **Görsel Proxy:** ADO'daki görseller `/api/rooms/{code}/ado-image-proxy?url=...` üzerinden sunulur (PAT ile authenticated, 24 saat cache)
- **HTML Sanitizasyonu:** ADO'dan gelen zengin metin içeriğindeki inline stil'ler (renk, font vb.) temizlenir — karanlık tema uyumluluğu için

---

## 🏗 Teknik Mimari

### Katmanlar

```
┌─────────────────────────────────────────────────────────────────────┐
│                          İSTEMCİLER                                 │
│  ┌──────────┐  ┌───────────────┐  ┌────────────────┐               │
│  │ Tarayıcı │  │ Electron App  │  │ Mobil Tarayıcı │               │
│  └─────┬────┘  └───────┬───────┘  └───────┬────────┘               │
│        │               │                  │                         │
├────────┼───────────────┼──────────────────┼─────────────────────────┤
│        ▼               ▼                  ▼                         │
│  ┌─────────────────────────────────────────────┐                    │
│  │              nginx / proxy (:80)             │  ← Docker/Prod    │
│  └──────┬────────────────────────┬──────────────┘                    │
│         │                        │                                  │
│    ┌────▼─────┐           ┌──────▼──────┐                           │
│    │ Frontend │           │   Backend   │                           │
│    │ Next.js  │           │  Express +  │                           │
│    │  (:3000) │           │ Socket.IO   │                           │
│    │          │           │  (:4000)    │                           │
│    └──────────┘           └──────┬──────┘                           │
│                                  │                                  │
│                           ┌──────▼──────┐                           │
│                           │   SQLite    │                           │
│                           │  (Sequelize)│                           │
│                           └──────┬──────┘                           │
│                                  │                                  │
│                           ┌──────▼──────┐                           │
│                           │ Azure DevOps│                           │
│                           │  REST API   │                           │
│                           └─────────────┘                           │
│                                                                     │
│  AI Sağlayıcıları:                                                  │
│  ┌────────┐ ┌────────┐ ┌───────┐ ┌────────┐ ┌─────────┐           │
│  │ Gemini │ │ChatGPT │ │Claude │ │Copilot │ │  Codex  │           │
│  │  API   │ │  API   │ │  CLI  │ │  CLI   │ │   CLI   │           │
│  └────────┘ └────────┘ └───────┘ └────────┘ └─────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Veritabanı Modelleri

| Model | Amaç | Anahtar Alanlar |
|-------|-------|----------------|
| **User** | Kayıtlı kullanıcı | email, password_hash, display_name |
| **Project** | ADO proje bağlantısı | organization, name, team, encrypted_pat |
| **Sprint** | Önbelleğe alınmış sprint | ado_sprint_id, name, start_date, finish_date |
| **Room** | Planning poker odası | code (6-hex), project_id, sprint_id, moderator_id |
| **ReferenceScore** | AI kalibrasyon örneği | title, description, story_points, project_id |
| **UserAISettings** | Kullanıcı AI tercihi | provider, encrypted_api_key |
| **WorkItemAIEstimate** | AI tahmin sonucu | story_point, confidence, analysis, similar_items |
| **WorkItemScoreRecord** | AI vs kullanıcı karşılaştırma | ai_score, user_avg_score, sprint_id |
| **RetroSession** | Retrospektif oturumu | code, title, status, duration_minutes, theme |
| **RetroItem** | Retro post-it | category, content, author_name, votes |
| **RetroAction** | Retro aksiyon maddesi | content, ai_suggested, is_accepted |

### İstek Akışı

| Ortam | Akış |
|-------|------|
| **Docker/Production** | Tarayıcı → nginx (:80) → backend (:4000) veya frontend (:3000) |
| **Development** | Frontend Next.js rewrites `/api/*` ve `/socket.io/*` → `http://localhost:4000` |
| **Electron** | `proxy.ts` → `/api` + `/socket.io` isteklerini backend child process'e yönlendirir |

---

## 🔐 Ortam Değişkenleri

| Değişken | Açıklama | Zorunlu |
|----------|----------|:-------:|
| `JWT_SECRET` | Express-session imzalama anahtarı | ✅ |
| `ENCRYPTION_KEY` | PAT/API key şifreleme anahtarı (AES-256-GCM) | ✅ |
| `FRONTEND_URL` | İzin verilen CORS origin'leri (virgülle ayrılmış) | ✅ |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend→Backend base URL | ✅ |
| `GEMINI_API_KEY` | Production'da AI için Gemini API anahtarı | 🔶 Prod |
| `NGROK_AUTHTOKEN` | Electron public URL tüneli | 🔶 Electron |
| `PORT` | Backend portu (varsayılan: 4000) | ❌ |
| `DB_PATH` | SQLite dosya yolu (varsayılan: `data/sprintermate.db`) | ❌ |

---

## 📊 Özellik Özet Tablosu

| Özellik | AI Destekli | Gerçek Zamanlı | Misafir Erişimi | ADO Entegrasyonu |
|---------|:-----------:|:--------------:|:---------------:|:----------------:|
| Kayıt / Giriş | ❌ | ❌ | — | ❌ |
| Proje Yönetimi | ❌ | ❌ | ❌ | ✅ |
| Planning Poker | ✅ | ✅ | ✅ | ✅ |
| Story Point Tahmini | ✅ | ✅ (toplu) | 🔶 (delegated mod) | ✅ |
| Puan Kaydetme | ❌ | ✅ | 🔶 (delegated mod) | ✅ |
| Retrospektif Board | ✅ | ✅ | ✅ | ❌ |
| Retro Trend Analizi | ✅ | ❌ | ❌ | ❌ |
| Sprint Metrikleri | ❌ | ❌ | ❌ | ✅ |
| Sprint AI İçgörüleri | ✅ | ❌ | ❌ | ✅ |
| AI vs İnsan Karşılaştırma | ✅ | ❌ | ❌ | ✅ |
| Çoklu Dil (TR/EN) | ✅ | ✅ | ✅ | — |

---

> **Sprintermate** — Scrum toplantılarınızı AI ile güçlendirin, veri-odaklı kararlar alın. 🚀
