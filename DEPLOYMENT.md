# 🚀 Scrum Poker - Deployment Rehberi

## ✅ Hazırlık (Tamamlandı)
- Dummy kullanıcılar kaldırıldı ✅
- AI Tahmin kısmı mock modda (Azure DevOps entegrasyonu sonra eklenecek) ✅
- Proje production-ready ✅

---

## 🎯 Önerilen Platform: **Vercel** (En Kolay & Ücretsiz)

### Neden Vercel?
- ✅ **Ücretsiz** (Hobby Plan)
- ✅ Next.js için **optimize edilmiş**
- ✅ **Otomatik SSL** sertifikası
- ✅ **Anında deployment** (Git push ile otomatik)
- ✅ **Global CDN**
- ✅ `.vercel.app` ücretsiz domain

---

## 📋 ADIM ADIM DEPLOYMENT (Vercel)

### 1️⃣ GitHub'a Projeyi Yükle

```powershell
# Git başlat (eğer yoksa)
cd "C:\Users\mehmet.ak\OneDrive - Doğuş Holding A.Ş\Desktop\ScrumPoker"
git init

# Dosyaları ekle
git add .
git commit -m "Initial commit - Scrum Poker App"

# GitHub'da yeni repo oluştur: https://github.com/new
# Repo adı: scrum-poker (veya istediğin isim)

# Remote ekle (GitHub'dan aldığın URL ile)
git remote add origin https://github.com/KULLANICI_ADIN/scrum-poker.git
git branch -M main
git push -u origin main
```

### 2️⃣ Vercel'de Deployment

1. **Vercel hesabı aç**: https://vercel.com/signup
   - GitHub ile giriş yap (önerilir)

2. **Yeni proje oluştur**:
   - Dashboard'da "Add New Project" tıkla
   - GitHub repo'sunu seç: `scrum-poker`

3. **Import ayarları**:
   ```
   Framework Preset: Next.js
   Root Directory: ./
   Build Command: npm run build (otomatik gelir)
   Output Directory: .next (otomatik gelir)
   ```

4. **Environment Variables** (şimdilik boş bırak, Azure sonra eklenecek)

5. **Deploy** butonuna bas!

### 3️⃣ Deployment Tamamlandı! 🎉

```
Canlı URL: https://scrum-poker-xxxx.vercel.app
```

Her `git push` yaptığında **otomatik** yeniden deploy olur!

---

## 🔄 Güncelleme Yapmak İstediğinde

```powershell
# Değişiklikleri kaydet
git add .
git commit -m "Yeni özellik eklendi"
git push

# Vercel otomatik deploy eder (30-60 saniye içinde canlıda!)
```

---

## 🌐 Alternatif Ücretsiz Hosting Platformları

### Option 2: **Netlify**
- Site: https://netlify.com
- Ücretsiz Plan: ✅
- SSL: ✅
- Dezavantajı: Next.js API Routes için ekstra config gerekir

### Option 3: **Railway**
- Site: https://railway.app
- Ücretsiz Plan: $5 monthly credit (yeterli)
- Full backend desteği: ✅
- Database ekleyebilirsin: ✅

### Option 4: **Render**
- Site: https://render.com
- Ücretsiz Plan: ✅ (free tier biraz yavaş)
- Full stack desteği: ✅

---

## ⚠️ ÖNEMLİ NOTLAR

### 1. In-Memory Storage Sorunu
Şu anda `rooms` Map yapısı **memory'de** tutuluyor:
```typescript
export const rooms = new Map<string, Room>()
```

**Sorun**: Server restart olunca tüm odalar silinir!

**Çözüm** (İleride):
- **Redis** (UpStash - ücretsiz): https://upstash.com
- **PostgreSQL** (Supabase - ücretsiz): https://supabase.com
- **MongoDB** (MongoDB Atlas - ücretsiz): https://mongodb.com/cloud/atlas

### 2. WebSocket Eksikliği
Şu anda **1 saniye polling** kullanıyorsun. Gerçek zamanlı için:
- **Pusher** (ücretsiz tier): https://pusher.com
- **Ably** (ücretsiz tier): https://ably.com
- **Socket.io** + Railway hosting

### 3. Rate Limiting
Production'da API'lere rate limit koy (spam önleme)

---

## 🎨 Özel Domain Bağlamak (İsteğe Bağlı)

Vercel'de custom domain ücretsiz:

1. Domain al (GoDaddy, Namecheap vb.)
2. Vercel Dashboard → Settings → Domains
3. Domain'i ekle
4. DNS ayarlarını güncelle (Vercel sana söyler)

---

## 📊 Azure DevOps Entegrasyonu (Sonra Eklenecek)

Environment variables ekle:

```bash
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PROJECT=your-project
AZURE_DEVOPS_PAT=your-personal-access-token
```

Vercel Dashboard → Settings → Environment Variables

---

## 🧪 Test Etme

Deploy olduktan sonra:

1. Yeni oda oluştur
2. QR kod veya link paylaş
3. Farklı cihazlardan katıl
4. Oy ver ve test et!

---

## 💡 İlk Deploy Sonrası Kontrol Listesi

- [ ] Ana sayfa açılıyor mu?
- [ ] Oda oluşturuluyor mu?
- [ ] QR kod çalışıyor mu?
- [ ] Link ile katılım oluyor mu?
- [ ] Oylar gözüküyor mu?
- [ ] "Oyları Göster" butonu çalışıyor mu?
- [ ] Mobil cihazda responsive mu?

---

## 🆘 Sorun Yaşarsan

### Build Hatası
```powershell
npm run build
```
Lokal'de çalıştır, hataları gör.

### Vercel Logs
Dashboard → Deployments → Click on deployment → Logs

### Common Issues
1. **"Module not found"** → `npm install` eksik paket
2. **"Build timeout"** → Free tier limiti, kodu optimize et
3. **"API Route 404"** → Route path'i kontrol et

---

## 📞 Destek

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Discord/Community: Vercel Discord

---

## 🚀 HEMEN BAŞLA!

```powershell
# 1. GitHub'a yükle
git add .
git commit -m "Production ready"
git push

# 2. Vercel'e git: https://vercel.com
# 3. Import repo
# 4. Deploy!
```

**5 dakika içinde canlıda olursun!** 🎉
