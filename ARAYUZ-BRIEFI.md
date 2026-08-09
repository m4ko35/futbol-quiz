# Futbol Quiz — Arayüz Tasarım Brifi

> **Bu belge kimin için.** Bu sitenin arayüzünü yeniden tasarlayacak biri (insan
> ya da yapay zekâ) için yazıldı. Ekran görüntüleriyle **birlikte** okunmalı:
> görüntüler bugünün hâlini gösteriyor, bu belge ise _neyin neden öyle olduğunu_
> ve **neye dokunulabileceğini** söylüyor.
>
> Hedef: siteyi **daha kullanışlı ve daha dikkat çekici** yapmak. Ürünün
> kurallarını değiştirmeden.
>
> Veri: 2026-08-07 tarihli küme. Belge 2026-08-10'da yazıldı.

---

## 1. Ürün nedir

Futbol bilgisini test eden, **Türkçe**, hesapsız ve tek oturumluk bir web
oyunu. Kullanıcı girmez, kaydolmaz, ödeme yapmaz — girer, oynar, çıkar.

Dört oyun modu var ve hepsi aynı veri kümesini kullanıyor: yirmi dört üst ligin
**tarihsel** kadroları. "Tarihsel" burada önemli: 1900'lerin başından bugüne
kadarki transferler var, yalnızca güncel kadrolar değil.

**Hedef kitle:** futbolu takip eden, transfer geçmişine meraklı, "bu oyuncu
Galatasaray'da mı oynamıştı?" tartışmasına girecek kişiler. Uzman değil ama
ilgili.

**Ton:** oyun gibi ama ciddiyetini koruyan. Veri kaynaklı bir site; abartılı
"skor patlaması" havası ürüne uymaz, ama bugünkü hâli de fazla durgun.

---

## 2. Sayılarla veri (tasarımı doğrudan kısıtlar)

| Ne                     | Kaç                            |
| ---------------------- | ------------------------------ |
| Lig                    | 24 (hepsi 1. kademe)           |
| Kulüp                  | 992 — seçilebilir olan **906** |
| **Arması olan kulüp**  | **396 / 906 = %43,7**          |
| Oyuncu                 | 132.263                        |
| Dönem (transfer kaydı) | 405.418 — 46.596'sı kiralık    |
| Veri tazelenme         | Yılda iki kez                  |

**En kritik satır armalarınki.** Kulüplerin **yarısından fazlasında arma yok** ve
bu düzelmeyecek: Vikipedi'deki armaların %84'ü adil kullanım lisanslı, yani
hukuken kullanılamıyor. Arma etrafına kurulan hiçbir tasarım çalışmaz. Ayrıntı
için §5'teki "Kulüp işareti" kuralına bak.

Ligler: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Süper Lig,
Eredivisie, Primeira Liga, İskoçya Premier Ligi, Belçika Birinci Ligi, Yunanistan
Süper Ligi, İsviçre Süper Ligi, Rusya Premier Ligi, Ekstraklasa, Çekya Birinci
Ligi, Hırvatistan Ligi, Ukrayna Premier Ligi, Danimarka Süper Ligi, Eliteserien,
Allsvenskan, Avusturya Bundesliga, Romanya Liga I, MLS, Suudi Pro Lig.

---

## 3. Dört oyun modu

Üstteki gezinme çubuğu bu dördü arasında geçiş yapıyor. Hepsi ayrı sayfa.

### 3.1 Ortak Oyuncu — `/` (ana sayfa)

**Soru:** iki kulüpte de forma giymiş oyuncular kimler?

**Akış:** kullanıcı iki kulüp seçer → altında ortak oyuncuların listesi çıkar.
Her satırda oyuncunun adı, mevkisi, uyruğu ve **iki kulüpteki dönemleri** var
(yıl aralığı, maç sayısı, kiralıksa rozet).

**Ekranda ne var:**

- İki kulüp seçici, aralarında bir `∩` işareti (geniş ekranda)
- Başlıkta iki kulüp işareti + "N ortak oyuncu" rozeti
- Oyuncu listesi — her satır iki sütuna bölünmüş (A'daki dönemler / B'deki dönemler)
- Sonuç boşsa açıklayıcı bir kutu
- Bazı özel durumlarda uyarı kutuları (§5'e bak)

**Sıkıntı:** bu mod bir "arama sonucu tablosu" gibi duruyor, oyun gibi durmuyor.
Sonucun geldiği an bir olay hissi vermiyor.

### 3.2 3×3 Izgara — `/izgara`

**Soru:** her hücre için, satır **ve** sütun kriterini birlikte sağlayan bir
oyuncu yaz.

Sütunlar hep kulüp; satırlar kulüp ya da ülke olabilir. Hücreye tıklanır, oyuncu
aranır, doğruysa hücre dolar. Günlük ızgara herkes için aynıdır. Kullanıcı kendi
ızgarasını da kurabiliyor (2×2'den 5×5'e).

**Ekranda ne var:** kriter başlıklı bir ızgara, doldurulmuş/boş hücreler, oyuncu
arama kutusu, doğru-yanlış geri bildirimi, bitişte özet.

**Sıkıntı:** ızgara asıl "paylaşılabilir" mod ama şu an paylaşma hissi yok.
Doldurulmuş bir ızgaranın kendisi görsel bir ödül olmalı.

### 3.3 İstatistik Eşleştirme — `/istatistik`

**Soru:** günün oyuncusunun altı istatistiği açıkça gösterilir; kullanıcı **her
istatistik için ayrı bir oyuncu** seçer — değeri ona en yakın olduğunu düşündüğü
kişiyi.

Altı istatistik: kulüp maçı, kulüp golü, oynadığı kulüp sayısı, A millî maç, boy
(cm), kilo (kg).

Soru "bu oyuncuyu tanıyor musun" değil, "**başka oyuncuların büyüklüklerini
biliyor musun**". Her seçim ayrı puanlanır, sonunda yüzde verilir.

**Sıkıntı:** kavramı anlamak ilk bakışta zor. Arayüz kuralı anlatmıyor, kullanıcı
deneyerek çözüyor.

### 3.4 Hangisi Daha — `/hangisi-daha`

**Soru:** kullanıcı bir istatistik ve bir yön seçer ("daha çok" / "daha az"); iki
oyuncu gelir, değerleri **gizlidir**, hangisinin fazla olduğunu seçer.

Doğruysa seçtiği oyuncu kalır, karşısına yenisi gelir — seri devam eder. Yanlışta
koşu biter, skor doğru cevap sayısıdır.

**Sıkıntı:** en "oyun" olan mod bu ve en çok tempo hak eden o. Şu an diğer üçüyle
aynı sakinlikte duruyor.

### 3.5 Kaynaklar — `/kaynaklar`

Arma lisans künyelerinin listelendiği yasal zorunluluk sayfası. Tasarımı sade
kalabilir ama **kaldırılamaz**.

---

## 4. Ortak parçalar

| Parça               | Ne yapar                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| **Başlık (header)** | Marka + dört mod arasında gezinme. Her sayfada aynı, düzen dosyasında.       |
| **Altbilgi**        | Veri kümesinin tarihi + kaynak/atıf bağlantıları.                            |
| **Kulüp seçici**    | Aşağıda ayrıntılı — sitenin en çok kullanılan bileşeni.                      |
| **Oyuncu seçici**   | Izgara ve istatistik modlarında oyuncu aramak için. Kulüp seçicinin kardeşi. |
| **Kulüp işareti**   | Arma varsa arma, yoksa baş harflerden üretilmiş bir rozet. Sabit ölçü.       |
| **Hata / 404**      | Kendi ekranları var, gezinme onlarda da çalışıyor.                           |

### Kulüp seçici (en önemli bileşen)

İki kademeli çalışıyor:

1. **Kutu boşken** 24 ligin listesi görünür (yanında kulüp sayısı).
2. **Bir lige tıklanınca** o ligin kulüpleri gelir; yazmak ligin içinde arar.
3. **Yazmaya başlanınca** (lig seçilmemişse) bütün kulüplarda arama yapılır.

Çıkış yolları: dışarı tıklama (yazılanı korur), `Escape` (kademe 2'de geri,
1'de kapat), **Vazgeç** düğmesi (her şeyi siler).

Büyük liglerde liste 50'de kesilir ve kesildiği açıkça yazılır:
_"83 kulüpten 50 tanesi gösteriliyor — daraltmak için yazın."_

---

## 5. DEĞİŞTİRİLEMEZ kurallar

Bunlar üslup tercihi değil; ihlal edilirse ürün yanlış çalışır ya da hukuken /
erişilebilirlik açısından kusurlu olur.

### 5.1 Kulüp işareti — boş yuva olamaz

Kulüplerin %56'sında arma **yok**. Kural: her kulüp adının yanında **sabit
ölçüde** bir işaret durur; arma varsa arma, yoksa kulüp adından türetilen baş
harfler (ör. `GS`, `FCB`). "Bazısında arma, bazısında boşluk" görüntüsü yasak —
listelerin yarısı delik görünürdü.

Tasarım bunu **avantaja çevirebilir** (baş harf rozetleri kendi başına bir görsel
dil olabilir) ama boş bırakamaz.

### 5.2 Kesme ve belirsizlik SESSİZ olamaz

Site, bilmediği şeyi bilmediğini söyler. Bu kurallar arayüzde metin gerektirir:

- Liste kesildiyse kaç kayıttan kaçının gösterildiği yazılır.
- Kaynakta tarih/maç bilgisi yoksa dönem "kaynakta ayrıntı yok" diye işaretlenir
  — silinmez.
- İki kulübün kadroları neredeyse aynıysa ("aynı kulübün iki kaydı olabilir")
  liste değiştirilmeden bir uyarı gösterilir.
- Veri kapsamı ana sayfada **baştan** söylenir: kullanıcı Ajax veya Porto arayıp
  bulamayınca siteyi bozuk sanmamalı.

Bu uyarılar **gizlenemez, dipnota itilemez**. Ama daha güzel sunulabilirler —
şu an düz gri kutular.

### 5.3 Erişilebilirlik tabanı (WCAG 2.1 AA)

- **Kontrast oranları otomatik testle korunuyor.** Palet serbest, ama yeni
  renkler de aynı eşikleri geçmeli: metin 4,5:1; arayüz bileşeni sınırı ve odak
  göstergesi 3:1. Test `globals.css`'i okuyup hesaplıyor — geçmezse derleme kırmızı.
- **Renk tek gösterge olamaz.** Kiralık dönem hem renkli hem "kiralık" yazılı;
  doğru/yanlış hücre hem renkli hem metinli olmalı.
- **Odak görünür olmalı**, `outline` ile (iç gölge değil).
- Klavye ile her şey yapılabilmeli; açılır listelerde odak metin kutusunda kalır.
- `prefers-reduced-motion` seçen kullanıcıda geçişler kapanır.

### 5.4 Renk belirteçleri **role** bağlıdır, tona değil

Bugünkü sistem şöyle: `background`, `surface`, `foreground`, `muted`, `line`,
`line-strong`, `accent`, `accent-fg`, `accent-soft`, `correct`, `wrong`, `warn`
(+ her birinin `-soft` hâli).

Hiçbir bileşen `dark:` varyantı taşımıyor — karanlık mod tek bir yerde,
belirteçlerin yeniden tanımlanmasıyla çözülüyor.

**Yeni palet serbest**, ama bu yapı korunmalı: rol adları kalmalı, koyu mod tek
yerden gelmeli. Yeni bir rol eklenebilir; rol yerine doğrudan renk yazılamaz.

### 5.5 Teknik sınırlar (bunlar aşılamaz)

- **Çalışma anında dış kaynak yüklenemez.** Katı bir CSP var: betik, stil,
  resim, yazı tipi — tarayıcı hiçbiri için dış sunucuya gidemez. CDN bağlantısı,
  `<link href="fonts.googleapis.com">`, dış ikon kütüphanesi **çalışmaz**.
  (Tek istisna: kulüp armaları `upload.wikimedia.org`'dan gelir.)
- **Yazı tipi kendi kaynağımızdan servis edilebilir olmalı.** Bu, Google Fonts
  ailelerini DIŞLAMAZ: `next/font/google` dosyaları derleme anında indirip
  kendi sunucumuzdan sunar, CSP'ye takılmaz — proje bugün Geist'i böyle
  kullanıyor. Dışlanan şey, dosyası alınamayan ya da gömmeye lisansı izin
  vermeyen yazı tipidir. Tasarımcının HTML çıktısında yazı tipi `data:` URI
  olarak gömülü ya da sistem yığını olmalı (orada dış bağlantı gerçekten
  çalışmaz); ailenin adı bildirilirse uygulamada `next/font` ile bağlanır.
- **Resim yalnızca armalardır.** Oyuncu fotoğrafı, stadyum görseli, forma
  görseli **yok** ve eklenemez (telif). Görsel zenginlik tipografi, renk, düzen
  ve yerleşimle üretilmeli.
- Arayüz dili **Türkçe**. (Altyapı çok dilliliğe hazır ama şimdilik tek dil.)
- Mobil dâhil her ekranda çalışmalı. Bugünkü duyarlı düzen **ölçüldü ve
  incedir**: bütün uygulamada toplam 15 duyarlılık sınıfı var ve 16 bileşenin
  10'unda hiç yok — bunlar arasında gezinme çubuğu (dört mod yan yana),
  istatistik modunun iki bileşeni ve iki seçici de bulunuyor. Yani dar ekran
  büyük ölçüde tasarlanmamış durumda, bozuk olduğu iddiası değil bu; ekran
  görüntüleriyle birlikte değerlendirilmeli.

---

## 6. SERBEST olan her şey

Yukarıdakiler dışında tasarım tamamen açık:

- Düzen, ızgara sistemi, boşluk ritmi, sayfa yapısı
- Tipografi — ölçek, ağırlık, karakter (dosya olarak gömülmek şartıyla)
- Renk paleti — kontrast eşiklerini geçmek şartıyla
- Bileşen biçimleri: kart, rozet, düğme, açılır liste, sekme
- Hareket ve geçişler (`prefers-reduced-motion`'a saygı şartıyla)
- İkonografi (satır içi SVG olarak)
- Ana sayfanın nasıl karşıladığı — şu an doğrudan oyuna giriyor
- Modlar arası gezinmenin biçimi
- Sonuçların, skorların, serilerin nasıl kutlandığı

---

## 7. Neyi çözmesini istiyoruz

Öncelik sırasıyla:

1. **İlk bakışta ne olduğu anlaşılsın.** Şu an siteye giren biri dört modun ne
   olduğunu okumadan anlamıyor.
2. **Sonuç anı bir olay olsun.** Dört modda da cevap gelince ekran neredeyse
   değişmiyor. Ödül hissi yok.
3. **Modlar birbirinden ayrışsın.** Dördü de aynı görünüyor; oysa biri liste,
   biri ızgara, biri tahmin, biri seri.
4. **Mobil düzen.** Duyarlılık sınıflarının dağılımı (§5.5) dar ekranın büyük
   ölçüde ele alınmadığını gösteriyor. Gezinme çubuğu, istatistik modu ve
   seçicilerde hiç kırılma noktası yok.
5. **Kulüp işareti bir zayıflık değil, bir dil olsun.** %56 baş harf rozeti
   gösteriyoruz — bu bir kusur gibi değil, bir kimlik gibi görünebilir.

---

## 8. Ekran görüntüsü listesi

Tasarımcının eksiksiz bir resim görmesi için şu ekranlar çekilmeli:

**Ortak Oyuncu (`/`)**

- [ ] Boş hâl (hiçbir kulüp seçilmemiş)
- [ ] Kulüp seçici açık — **lig listesi** görünürken
- [ ] Kulüp seçici açık — bir **ligin içindeyken** (Serie A: kesme uyarısı görünür)
- [ ] Kulüp seçici açık — yazarak arama yapılırken
- [ ] İki kulüp seçili, sonuç listesi dolu (ör. Fenerbahçe ∩ Beşiktaş → 55 oyuncu)
- [ ] Kanıtsız dönem işareti görünen bir sonuç
- [ ] Sonuç boş çıkan bir çift

**3×3 Izgara (`/izgara`)**

- [ ] Boş ızgara
- [ ] Oyuncu arama kutusu açık
- [ ] Kısmen dolu ızgara (doğru + yanlış hücre birlikte)
- [ ] Bitmiş ızgara / özet
- [ ] "Sen kur" ekranı

**İstatistik (`/istatistik`)**

- [ ] Günün oyuncusu ve altı istatistik
- [ ] Bir istatistik için seçim yapılırken
- [ ] Sonuç / puan ekranı

**Hangisi Daha (`/hangisi-daha`)**

- [ ] İstatistik ve yön seçimi
- [ ] Karşılaştırma turu
- [ ] Doğru cevap sonrası
- [ ] Koşu bitti ekranı

**Genel**

- [ ] Açık tema ve koyu tema (ikisi de)
- [ ] Mobil genişlik (ör. 390px) — en az ana sayfa ve ızgara
- [ ] `/kaynaklar`
- [ ] 404 ekranı

---

## 9. Tasarımcıdan beklenen çıktı

### 9.1 Biçim

**Tek dosya, kendi kendine yeten HTML.** Ekran görüntüsü, PDF, sıkıştırılmış
klasör ya da çalışır bir Next.js projesi istenmiyor. Stiller `<style>` içinde,
dış bağlantı yok.

**Yazı tipi mockup'ta sistem yığınıyla gösterilir.** Gerçek yazı tipi dosyası
mockup'a gömülemez (dış bağlantı çalışmaz, ikili veri de uydurulamaz). Bu yüzden
asıl aile _adıyla_ bildirilir, mockup'ta ona **ölçüsel olarak yakın** bir sistem
yığınıyla temsil edilir — böylece satır uzunluğu ve ritim yanıltmaz. Gerçek
aileyi uygulamaya `next/font` ile ben bağlarım; nihai tipografi kararı mockup'ta
değil, çalışan uygulamada verilir.

Sebebi: paleti, tipografi ölçeğini, durumları, boşluk ritmini ve hareketi **aynı
anda** taşıyan tek biçim bu. Resimden renk değeri okunmuyor; hazır bir proje
kodundan da niyet okunmuyor, üstelik mimarimize girmiyor.

### 9.2 Teslim sırası

1. **Önce yalnızca yön:** palet (4–6 hex), tipografi eşleşmesi ve gerekçesi,
   düzen konsepti. Bu aşamada ekran çizilmez.
2. **Yön onaylandıktan sonra ekranlar,** mod mod.

Ters sıra pahalıya patlar: on ekran çizildikten sonra yön reddetmek, her şeyi
baştan aldırmak demek.

### 9.3 İçerik

1. **Ekran bazında tasarım** — §8'deki listeye karşılık gelen ekranlar.

2. **Belirteç bloğu** — şu değişkenlerin açık ve koyu değerleri, geçerli CSS
   olarak. Rol adları korunur; yeni rol eklenebilir, rol yerine doğrudan renk
   yazılamaz (§5.4):

   ```css
   :root {
     --background: --surface: --foreground: --muted: --line: --line-strong:
       --accent: --accent-fg: --accent-soft: --correct: --correct-soft: --wrong:
       --wrong-soft: --warn: --warn-soft: --shadow-card: --shadow-pop: ;
   }
   ```

   Yanında kontrast oranları (§5.3 eşikleri) şu çiftler için verilmeli:
   `foreground`/`background`, `foreground`/`surface`, `muted`/`background`,
   `muted`/`surface`, `accent-fg`/`accent`, `warn`/`warn-soft`,
   `wrong`/`wrong-soft`, `correct`/`correct-soft`, `line-strong`/`background`.
   Bu oranlar uygulamada otomatik testle ölçülüyor; tutmayan palet geri döner.

3. **Bileşen envanteri** — düğme, kart, rozet, açılır liste, ızgara hücresi;
   durumlarıyla: normal, üzerinde, **odaklı**, seçili, devre dışı, doğru,
   yanlış. Odak durumu atlanamaz — klavye gezinmesi testli.

4. **Tipografi ölçeği** — hedeflenen aile(ler), ağırlıklar, boyutlar, satır
   yükseklikleri; ayrıca mockup'ta kullanılan sistem yığını. Hedef aile kendi
   kaynağımızdan servis edilebilir olmalı (§5.5) ve **Türkçe karakterleri
   eksiksiz taşımalı**: `ı İ ğ Ğ ş Ş ç Ç ö Ö ü Ü`. Noktasız `ı` ile noktalı
   `İ` birçok görüntü yazı tipinde eksiktir ya da bozuk çizilir.

5. **Mobil (390px) ve masaüstü (1440px)** için ayrı düzen kararları.

6. **Hareket notları** — nerede, ne kadar, hangi amaçla; ve
   `prefers-reduced-motion` açıkken karşılığı ne.

### 9.4 Kabul edilmeyecekler

Tasarım bunlardan birine dayanıyorsa uygulanamaz, geri döner:

- Çalışma anında dış bağlantı — yazı tipi, ikon, betik, CDN, uzak görsel (§5.5)
- Bileşen kütüphanesi (shadcn, Radix, MUI …). Erişilebilirlik davranışları elle
  yazılmış ve testli; kütüphane onları geri götürür
- Karanlık modun `dark:` varyantlarıyla çözülmesi — koyu mod tek yerden,
  belirteçlerin yeniden tanımıyla gelir (§5.4)
- Arması olmayan kulüp için boş yuva (§5.1)
- Kesme ya da belirsizlik göstergesinin kaldırılması, dipnota itilmesi (§5.2)
- Arma dışında uzaktan gelen görsel; oyuncu fotoğrafı (§5.5)
- İngilizce etiket

> Tasarım Tailwind v4 + CSS özel değişkenleriyle uygulanacak.
