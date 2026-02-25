# Roadmap

## TODO

- [ ] Desktop uygulaması Github action üzerinen build edilebilir olacak.
- [ ] Moderatör 1 kişi ancak moderatörlük yetkisi birden çok kişiye verilebilir. Online kısmındaki kişilerden dilediğine sağ tıklayıp moderatörlük verebilir. Bu kişinin rölü self-moderator olarak değiştirilebilir. Ana moderatör, moderatörlük yetkisi verdiğinde online şeridinde "Moderatörlüğü geri al" butonu ortaya çıkacaktır ve dilediğinde geri alıp başkasına verebilir veya kendi devam edebilir.
- [ ] Puanlama sadece fibonacci bazlı olmayacak, proje oluşturulurken aşağıdaki tiplerde kullanılacak. Ayrıca ? ve ☕ seçimleride mümkün olacak
  - Fibonacci (1, 2, 3, 5, 8, 13, 21, ...)
  - Modified Fibonacci (0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, ...)
  - T-shirts (XS, S, M, L, XL, XXL)
  - Powers of 2 (0, 1, 2, 4, 8, 16, 32, 64, 128)
- [ ] Havalı bir websitesi, daha detaylı bir şekilde geliştirilecek.
- [ ] websitesi üzerinden çalışan versiyonda ücretli versiyon sunulacak.
- [ ] Localization eksikleri giderilmeli
- [ !!! ] Takımid - workitem id bazlı bir ai önerdiği puan ve azure'a kaydedilen puan olarak metrik tutulması böylece ai önerisinin yüzde kaçı kabul ediliyor ve ai önerisinin takım kararı ile doğruluk standart sapması ne bunu ölçümlendirmek çok önemli. Burada projects tab'ında projeye tıkladığında buradaki verilerin analiz edilmiş standart sapmasının görüntülendiği bir ekran açılabilir böylece bu projeyi ekleyen kişiler bu bilgilerin analizi sonucunda ai önerisinin başarı metriğini ölçebilir. AI analiz kısmında da burada hesaplanan puan standart sapması ile takım puanlamasına daha uygun yatkın davranma özelliği de katılabir.


## Done

- [x] Light mode / dark mode desteği yukarıdaki navbar üstündeki küçük bir sembölle yönetilir. aydınlık tema cyan / green bazlı olacak, karanlık tema indigo bazlı olacak. aydınlık tema canlı olacak.
- [x] electron ile desktop uygulaması üzerinden docker bağımsız çalışabilen bir uygulama olacak.
- [x] Puanlama ekranında hangi karta kaç puan gelmiş, kart bazlı kategorik şekilde puanlar gösterilecek.
- [x] Son 10 sprintteki benzer işleri analiz eden ve AI kapsam değerlendirmesi + geçmiş benzer task ortalaması + anlık takım oylamasını (%60 / %25 / %15) ağırlıklandırarak otomatik Story Point önerisi üreten hibrit tahmin sistemi.AI otomatik tetiklensin veya maddeye girince ek olarak tahminle butonu YZ ile tahminle kısmı ekranda dursun tabiki de. Böylece manuel tahminle deme zahmeti ortadan kalkar ve ai sonuçlarını göster diyince gözüksün ki diğer kullanıcıları etkilemesin.
- [x] Azure'da madde yorumlarının da alınıp madde detayına eklenmesi kısmı yapıldı
