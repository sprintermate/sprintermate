# Proje: AI-Powered "Old School" Retro App

## 1. Proje Amacı
Takımların Agile/Scrum retrospektiflerini nostaljik bir sınıf atmosferinde (tahta ve tebeşir) gerçekleştirmesini sağlayan, geçmiş verileri analiz ederek tekrarlayan sorunları tespit eden ve AI destekli aksiyon önerileri sunan web uygulaması.

## 2. Görsel Tasarım ve Tema (UI/UX)
Uygulama, "Eski Okul" (Old School) konsepti üzerine kuruludur ve iki ana mod barındırır:

### A. Dark Mode: "Kara Tahta & Tebeşir"
* **Arka Plan:** Hafif dokulu, koyu yeşil veya siyah kara tahta efekti.
* **Yazı Tipi:** Tebeşirle yazılmış hissi veren (Chalkboard/Handwritten) fontlar.
* **Renk Paleti:** Beyaz tebeşir rengi ana yazı rengi; sarı, açık mavi ve pembe tebeşir renkleri vurgular için.
* **Efektler:** Post-it'lerin kenarlarında hafif tozlu/tebeşirli bir doku.

### B. Light Mode: "Beyaz Tahta & Marker"
* **Arka Plan:** Parlak, temiz beyaz tahta (whiteboard) görünümü.
* **Yazı Tipi:** Keçeli kalemle yazılmış gibi duran (Marker/Ink) fontlar.
* **Renk Paleti:** Siyah marker ana yazı rengi; mavi, kırmızı ve yeşil board-pen renkleri kategoriler için.
* **Efektler:** Silinmiş kalem izlerini andıran çok hafif gri dokular.

## 3. Temel Özellikler

### Board Yapısı
* **Üç Ana Bölüm:** "Neler İyi Gitti?", "Neler Kötü Gitti?", "Gelecek İçin Fikirler".
* **Sanal Post-it:** Tahta üzerine yapıştırılan renkli kağıtlar.
* **Geri Sayım:** Tahtanın bir köşesine tebeşirle çizilmiş gibi duran dijital kronometre.

### AI Zeka Katmanı
* **Kısa & Net Öneriler:** Yazılan post-it'leri o anki bağlama göre analiz eder ve "Alınacak Aksiyon" önerir.
* **Aksiyon Düzenleme:** AI önerilerine ekleme/çıkarma yapılabilir ve "Kaydet" denildiğinde veritabanına işlenir.
* **Gidişat Analizi (Trend):** Mevcut retonun sonuçlarını eskilerle kıyaslar. 
    * *"Hangi hata hala devam ediyor?"* * *"Hangi alan daha iyiye gidiyor?"* gibi sorulara görsel raporlar sunar.

## 4. Teknik Stack Önerisi
* **Frontend:** Next.js (Tailwind CSS ile Custom Themes).
* **Styling:** `next-themes` (Dark/Light geçişi için) ve özel SVG maskeleri (tebeşir dokusu için).
* **Database:** PostgreSQL (Aksiyonlar ve tarihsel kıyaslama verileri için).
* **AI:** OpenAI GPT-4o (Analiz ve karşılaştırmalı raporlama için).

## 5. Akış
1. **Ders Başlıyor:** Mod seçilir (Kara Tahta / Beyaz Tahta).
2. **Yazma:** Takım post-it'lerini "tahtaya" bırakır.
3. **Zil Çalıyor:** Süre biter, AI tahtayı okur ve aksiyonları önerir.
4. **Karne:** Önceki retrolarla karşılaştırma grafiği (iyileşme/kötüleşme analizi) gösterilir.

