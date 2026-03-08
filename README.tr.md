# Sprintermate

> 🌐 [English](README.md) | **Türkçe**

![Sprintermate](LOGO.jpg)

**Ekibinizin daha akıllı tahmin yapmasını sağlayan planlama pokeri.**

Sprintermate, gerçek zamanlı işbirlikçi oylamayı yapay zeka destekli hikaye puanı tahminiyle birleştirir. Ekibiniz birlikte oy kullanır, yapay zeka geçmişinizden öğrenir ve tahminler her sprint'te daha iyi hale gelir — sonsuz tartışmalara ve sabitleme önyargısına son.

- **Gerçek zamanlı oylama** — herkes aynı anda oy kullanır, hazır olunca sonuçları açıklayın
- **Yapay zeka tahmini** — AI kapsam analizini ekibinizin geçmiş hızıyla birleştirir
- **Azure DevOps entegrasyonu** — iş öğelerini doğrudan çekin, kopyala-yapıştır yok
- **Her yerde çalışır** — tarayıcı, masaüstü uygulaması veya kendi sunucunuzda
- **Açık kaynak** — verilerinize sahip olun, istediğiniz gibi çalıştırın

**Teknoloji:** Next.js 14 · Express · Socket.IO · SQLite/PostgreSQL · TypeScript · Tailwind CSS

# Nasıl kullanabilirim?

Sprintermate'i kurulum gerektirmeden bulutta kullanabilir ya da yerel olarak kendi sunucunuzda çalıştırabilirsiniz.

## Bulut versiyonu

**[sprintermate.com](https://sprintermate.com)** adresini ziyaret edin ve saniyeler içinde bir oturum başlatın.

## Yerel olarak çalıştırma

Sprintermate'i yerel olarak çalıştırmak için 3 seçeneğiniz var: masaüstü uygulaması, Docker veya manuel olarak Node.js ile. Masaüstü uygulaması, herhangi bir bağımlılık gerektirmeden başlamanın en kolay yoludur.

### Masaüstü Uygulaması

Docker veya Node.js gerektirmez. Yerleşik ngrok tüneli ile yerel uygulama olarak indirilir ve çalıştırılır.

```bash
bash scripts/build-electron.sh
cd electron && npm run dist:mac    # → dist-electron/Sprintermate-*.dmg
cd electron && npm run dist:win    # → dist-electron/Sprintermate-*.exe
cd electron && npm run dist:linux  # → dist-electron/Sprintermate-*.AppImage
```

İlk başlatmada ücretsiz bir [ngrok auth token](https://dashboard.ngrok.com/get-started/your-authtoken) girmeniz istenecektir. Uygulama her şeyi başlatır ve sistem tepsisinde paylaşılabilir bir genel URL gösterir.

## Docker

```bash
cp .env.example .env
# Ayarlayın: JWT_SECRET, ENCRYPTION_KEY, NGROK_AUTHTOKEN
docker compose up --build
# Uygulama: http://localhost | ngrok inspector: http://localhost:4040
```

### Manuel

Node.js ve paylaşılabilir URL için ücretsiz bir [ngrok](https://dashboard.ngrok.com/get-started/your-authtoken) hesabı gerektirir.

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev     # http://localhost:4000

# Terminal 2 — frontend
cd frontend && npm install && npm run dev    # http://localhost:3000

# Terminal 3 — ngrok (isteğe bağlı, paylaşım için)
ngrok http 3000
```

`backend/.env.example` dosyasını `backend/.env` olarak kopyalayın ve `JWT_SECRET`, `ENCRYPTION_KEY` ile `FRONTEND_URL=http://localhost:3000` değerlerini ayarlayın.

---

## Ortam Değişkenleri

| Değişken          | Açıklama                                               |
| ----------------- | ------------------------------------------------------ |
| `JWT_SECRET`      | Oturum imzalama için gizli anahtar                     |
| `ENCRYPTION_KEY`  | Azure DevOps PAT şifrelemesi için AES-256-GCM anahtarı |
| `FRONTEND_URL`    | CORS kaynakları — birden fazla için virgülle ayırın    |
| `NGROK_AUTHTOKEN` | ngrok token'ı (yalnızca Docker)                        |
| `PORT`            | Backend portu (varsayılan `4000`)                      |
| `DB_PATH`         | SQLite dosya yolu (varsayılan `data/sprintermate.db`)  |
