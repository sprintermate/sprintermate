# Roadmap

## TODO

- [ ] Moderatör 1 kişi ancak moderatörlük yetkisi birden çok kişiye verilebilir. Online kısmındaki kişilerden dilediğine sağ tıklayıp moderatörlük verebilir. Bu kişinin rölü self-moderator olarak değiştirilebilir. Ana moderatör, moderatörlük yetkisi verdiğinde online şeridinde "Moderatörlüğü geri al" butonu ortaya çıkacaktır ve dilediğinde geri alıp başkasına verebilir veya kendi devam edebilir.
- [ ] Ayrıca ? ve ☕ seçimleride mümkün olacak. Kahve molasında olan kişi sıfırlama yapılsa da farklı maddeye geçilse de tekrar oy verene kadar kahve molasında olacak. ? ise kararsız oy demek anlamına gelir ve kullanıcı oy vermiş gibi değerlendirilir. Sonuç grafiğinde ortalama hesaplamasına yazılmaz ama puan ve kişi sayısını gösteren yerde ? yer almalıdır. 
- [ ] Login github hesabıyla yapılacak ve token kullanımı buradan olacak.
- [ ] exe indirilince localde çalıştırmak için security izni gerekmektedir !!! yöneticiyle konuşulmalı (genel kullanım için)
- [ ] Projeleriniz altındaki projeye tıklandığın açılacak olan ekranda sprint metrikleri ölçülmüş bir grafik gelicek ve seçilen sprint'in metriklere gelecek. Dashboard ekranında neler olacak ?
- [ ] Oylar göster dedikten sonra kişiler oylarını güncelleyebilsin
- [ ] Moderatörlüğü devretme özelliği olsun ve aynı aı tahminleri birebir tüm moderatörlük devredilen kişiye verilsin (kişi üstüne tıklayıp moderatörlük devret denilebilir!) veya herkes moderatör olur

## Done
- [x] Localization eksikleri giderilmeli
- [x] Light mode / dark mode desteği yukarıdaki navbar üstündeki küçük bir sembölle yönetilir. aydınlık tema cyan / green bazlı olacak, karanlık tema indigo bazlı olacak. aydınlık tema canlı olacak.
- [x] electron ile desktop uygulaması üzerinden docker bağımsız çalışabilen bir uygulama olacak.
- [x] Puanlama ekranında hangi karta kaç puan gelmiş, kart bazlı kategorik şekilde puanlar gösterilecek.
- [x] Son 10 sprintteki benzer işleri analiz eden ve AI kapsam değerlendirmesi + geçmiş benzer task ortalaması + anlık takım oylamasını (%60 / %25 / %15) ağırlıklandırarak otomatik Story Point önerisi üreten hibrit tahmin sistemi.AI otomatik tetiklensin veya maddeye girince ek olarak tahminle butonu YZ ile tahminle kısmı ekranda dursun tabiki de. Böylece manuel tahminle deme zahmeti ortadan kalkar ve ai sonuçlarını göster diyince gözüksün ki diğer kullanıcıları etkilemesin.
- [x] Azure'da madde yorumlarının da alınıp madde detayına eklenmesi kısmı yapıldı
- [x] Madde detayda proxy ile görsel getirme eklendi.
- [x] Desktop uygulaması Github action üzerinen build edilebilir olacak.
- [x] Oylar göster dedikten sonra kişiler oylarını güncelleyebilsin oyları göster diyince güncelleyebilsin kullanıcılar
- [x] Work item oylaması yapıldıktan sonra sonraki madde butonu olsun önceki madde butonu da olsun listeye dön demeden ileri ve geri gidebilinsin daha akıcı hale gelmiş olur ekran deneyimi.


## MVP 2
- [ ] Puanlama sadece fibonacci bazlı olmayacak, proje oluşturulurken aşağıdaki tiplerde    kullanılacak.
   Fibonacci (1, 2, 3, 5, 8, 13, 21, ...)
   Modified Fibonacci (0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, ...)
   T-shirts (XS, S, M, L, XL, XXL)
   Powers of 2 (0, 1, 2, 4, 8, 16, 32, 64, 128)
- [ ] Havalı bir websitesi, daha detaylı bir şekilde geliştirilecek.
- [ ] websitesi üzerinden çalışan versiyonda ücretli versiyon sunulacak.
- [ ] Retro ekranı olacak geçmiş notlar mevcuttakini analiz edip aksiyonlar önerecek !