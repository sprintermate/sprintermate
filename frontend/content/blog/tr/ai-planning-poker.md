---
title: "Yapay Zeka Sprint Planlama Pokerini Nasıl Dönüştürüyor"
description: "YZ destekli tahminlemenin agile ekiplerin daha hızlı hareket etmesine, yanlılığı azaltmasına ve planlama pokeri sırasında daha akıllı hikaye puanı kararları almasına nasıl yardımcı olduğunu keşfedin."
date: "2025-06-15"
author: "Sprintermate Ekibi"
slug: "ai-planning-poker"
tags: ["YZ", "Sprint Planlaması", "Agile", "Hikaye Puanları"]
---

## Geleneksel Planlama Pokerinin Sorunu

Her agile ekip bu ritüeli bilir: bir iş öğesi ortaya çıkar, biri "3 puan" diye sabitleme yapar ve birden tüm ekip o sayıya yönelir. Ya da özelliğin 5 mi yoksa 8 mi olduğu konusunda kimse anlaşamadığı için toplantı iki saat sürer.

Planlama pokeri, tahmin yanlılığıyla savaşmak için tasarlanmıştı — ancak yine de sosyal dinamiklere, sabitleme etkilerine ve basit yorgunluğa yenik düşebilir.

## YZ Masaya Ne Getiriyor?

YZ tahminleme ekibinizin yargısının yerini almaz. Onu güçlendirir.

Bir YZ modeline son üç sprintteki tamamlanmış iş öğelerini — açıklamaları, kabul kriterlerini ve nihai hikaye puanlarını — beslerseniz, model *ekibinizin boyutlandırma kurallarının* bir resmini oluşturur; genel bir referans değil. Yeni bir öğe geldiğinde YZ şunu söyleyebilir: "Ekibinizin gönderdiği 47 benzer öğeye göre bu bir 5'e benziyor. Referans olarak üç karşılaştırılabilir özellik burada."

Bu birkaç şey yapar:

- **Sabitleme yanlılığını azaltır** — YZ tahmini, oylama başlamadan yalnızca moderatöre gösterilir. Ekip kör oy verir, ardından YZ'nin görüşünü sonuçların yanında görür.
- **Aykırı değer konuşmalarını hızlandırır** — bir kişi 13, diğerleri 5 oyladığında YZ tahmini tartışmayı çıpalamak için tarafsız bir veri noktası sunar.
- **Kurumsal bellek oluşturur** — YZ tahminlemeyi birden fazla sprint boyunca kullanan ekiplerin tahminlerinin yakınsadığı görülür. YZ, ekibi kendine yansıtır.

## Sprintermate AI Nasıl Çalışır?

Sprintermate AI, Azure DevOps ile doğrudan entegre olur. Bir proje kurduğunuzda:

1. Sprint panosu URL'nizi ve Kişisel Erişim Belirtecinizi bağlayın
2. Bilinen hikaye puanlarıyla 5–10 referans iş öğesi ekleyin — bunlar YZ'yi ekibinize göre kalibre eder
3. Bir oda oluşturun ve 6 karakterli kodu ekibinizle paylaşın

Oturum sırasında moderatör bir iş öğesi seçer. YZ, onu referans öğeleriniz ve önceki sprintlerinizle karşılaştırarak analiz eder, ardından moderatöre güven derecesi (Yüksek / Orta / Düşük) ve benzer öğelere referanslarla birlikte önerilen bir tahmin sunar. Ekip YZ sonucunu görmeden oy verir. Açılışın ardından YZ tahmini oylama dağılımının yanında görünür.

## Ekiplerin Gördüğü Sonuçlar

YZ destekli planlama pokeri kullanan ekipler şunları bildiriyor:

- **%30–40 daha hızlı oturumlar** — YZ tartışmaya bir başlangıç noktası verdiği için daha az tavşan deliği
- **İlk turda daha yüksek fikir birliği** — YZ güvenilir olduğunda ekip daha hızlı anlaşma eğilimi gösteriyor
- **Daha iyi oryantasyon** — yeni ekip üyeleri kod tabanını öğrenirken YZ'nin tarihsel bağlamına yaslanabilir

## YZ'nin Yapamadıkları

YZ tahminlemesi yalnızca tarihsel verileriniz kadar iyidir. Yalnızca iki sprint tamamladıysanız veya referans öğeleriniz belirsizse YZ size düşük güvenilirlikli bir tahmin verecektir — ki bu yine de faydalı bir bilgidir.

YZ ayrıca yazmadığınız iş bağlamını da anlayamaz. Bir "küçük" özellik aslında uyumluluk denetimi gerektiriyorsa ekip YZ tahminini geçersiz kılmalıdır. Sistem bunun için tasarlanmıştır: açılışın ardından moderatör, YZ'nin önerdiği şeyden bağımsız olarak Azure DevOps'a kaydetmek için herhangi bir nihai puanı seçebilir.

## Başlarken

Henüz yapmadıysanız, [ücretsiz bir Sprintermate AI hesabı oluşturun](/) ve ilk Azure DevOps projenizi bağlayın. Kalibrasyon adımı yaklaşık 10 dakika sürer ve ilk YZ destekli planlama oturumunuz backlog'unuzdaki tahmin belirsizliğinin tam olarak nerede yattığını size gösterecektir.

Daha akıllı planlama daha iyi verilerle başlar — ve daha iyi veriler ilk oturumunuzla başlar.
