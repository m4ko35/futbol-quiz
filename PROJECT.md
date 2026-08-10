# Futbol Quiz — Proje Şartnamesi

> Bu belge projenin tek referans kaynağıdır (single source of truth).
> Kod ile belge çeliştiğinde önce bu belge güncellenir, sonra kod yazılır.

**Sürüm:** 0.1.0
**Tarih:** 2026-08-06
**Durum:** Faz 4.9 tamamlandı — üç oyun modu çalışıyor, ikinci kaynak (Vikipedi, 5 dil) devrede, kapsam 22 lige çıktı. Kalan tek faz 4.5: yayın.

---

## 1. Amaç ve Kapsam

### 1.1 Ürün Tanımı

Kullanıcının seçtiği **iki futbol kulübünün ikisinde de forma giymiş** oyuncuları listeleyen bir web uygulaması. İlk sürüm bu tek oyun modunu eksiksiz ve doğru şekilde sunar; mimari, sonradan eklenecek oyun modlarını **çekirdek koda dokunmadan** kabul edecek biçimde tasarlanır.

### 1.2 İlk Sürüm (MVP) Kapsamı

| Dahil                                                  | Hariç (sonraki fazlar)         |
| ------------------------------------------------------ | ------------------------------ |
| İki kulüp seçimi (aranabilir, klavye ile erişilebilir) | Kullanıcı hesabı / giriş       |
| Ortak oyuncuların listelenmesi                         | Skor tablosu, çok oyunculu mod |
| Her oyuncunun her iki kulüpteki dönem bilgisi          | Yorum, sosyal paylaşım, profil |
| Kiralık/asıl transfer ayrımı                           | Ödeme, abonelik                |
| Türkçe arayüz (i18n altyapısı hazır)                   | Mobil uygulama                 |

### 1.3 Veri Kapsamı

Avrupa'nın 22 üst ligi:

| Lig            | Ülke      | Wikidata QID | Güncel kadro | Veri kümesi | Seçilebilir |
| -------------- | --------- | ------------ | ------------ | ----------- | ----------- |
| Premier League | İngiltere | `Q9448`      | 20           | 51          | 51          |
| La Liga        | İspanya   | `Q324867`    | 21           | 61          | 57          |
| Serie A        | İtalya    | `Q15804`     | 28           | 92          | 81          |
| Bundesliga     | Almanya   | `Q82595`     | 18           | 76          | 59          |
| Ligue 1        | Fransa    | `Q13394`     | 22           | 75          | 68          |
| Süper Lig      | Türkiye   | `Q485568`    | 20           | 33          | 29          |
|                |           | **Toplam**   | **129**      | **388**     | **345**     |

> Tablo **Faz 1 ölçümüdür** ve o günkü değerleri kaydeder. Güncel sayılar
> §10.1'in doğrulanabilir tabanındadır; ikisi bilerek ayrı tutuluyor.

#### Yayın öncesi genişleme: Eredivisie ve Primeira Liga

Kapsam yayından **önce** genişletildi. Gerekçe §1.3'ün kendi cümlesiydi:
"Kullanıcı Ajax, Porto, Benfica veya Celtic arayınca hiçbir şey bulamayacak."
Bunlardan üçü artık bulunuyor.

**QID'ler tahmin edilmedi, ölçüldü** — bu bölümün kendi kayıtlı hatası
(Süper Lig için ilk tahmin `Q170323` **Nintendo DS**'e aitti) yöntemi
belirledi. Hollanda ve Portekiz'in tüm futbol ligleri ülke + sınıf üzerinden
listelendi ve ölçüm bir varsayımı daha çürüttü: **üst lig, en çok kulüp
barındıran lig DEĞİL.**

| QID           | Lig                    | Ülke     | `Q476028` kulüp |
| ------------- | ---------------------- | -------- | --------------- |
| `Q13668768`   | Campeonato de Portugal | Portekiz | 61              |
| `Q1877646`    | Vierde Divisie         | Hollanda | 47              |
| `Q754488`     | LigaPro                | Portekiz | 32              |
| **`Q167541`** | **Eredivisie**         | Hollanda | **23**          |
| **`Q182994`** | **Primeira Liga**      | Portekiz | **23**          |

Ada göre seçilseydi bu tuzağa düşülmezdi; sayıya göre seçilseydi alt liglere
düşülürdü. Karar, projenin kendi `verifyLeagues` sorgusuyla doğrulandı.

**Çekim sorgusuyla ölçülen kulüp sayısı** (6 sınıflık beyaz liste, tüm `P118`
ifadeleri — §5.3): Eredivisie **29**, Primeira Liga **36**.

**Ligin amacı olan kulüplerin geldiği tek tek doğrulandı.** Bu denetim
zorunludur çünkü tür kısıtı bu projede bir kez FC Barcelona'yı listeden
düşürmüştü:

| Eredivisie                           | Primeira Liga                       |
| ------------------------------------ | ----------------------------------- |
| AFC Ajax · PSV Eindhoven · Feyenoord | FC Porto · SL Benfica · Sporting CP |
| AZ Alkmaar · FC Twente · FC Utrecht  | SC Braga · Vitória SC · Boavista FC |

> **Ölçüm bir kusuru önceden gösterdi:** `Sporting CP` sorgudan **dört kez**
> dönüyor. Yeni ligler kendi kulüp ikizlerini de getiriyor; §5.3'ün
> birleştirmesi ve ayırt edici ad geçişi bunu karşılamak zorunda. Sonuç
> koşudan sonra ölçülür.

**Koşu sonucu (2026-08-06).** Kapsam 6 → **8 lig**:

| Lig               | Kulüp | Seçilebilir | Dönem  | Pay   |
| ----------------- | ----- | ----------- | ------ | ----- |
| Serie A           | 96    | 83          | 62.168 | %25,3 |
| Premier League    | 51    | 51          | 55.798 | %22,7 |
| Ligue 1           | 76    | 71          | 30.774 | %12,5 |
| La Liga           | 60    | 58          | 29.653 | %12,1 |
| Bundesliga        | 59    | 59          | 27.854 | %11,3 |
| Süper Lig         | 41    | 41          | 14.480 | %5,9  |
| **Eredivisie**    | 32    | 28          | 13.110 | %5,3  |
| **Primeira Liga** | 34    | 33          | 12.160 | %4,9  |

Toplam **449 kulüp · 84.800 oyuncu · 245.997 dönem** (383 / 76.757 / 220.058
idi). Ajax **1.000**, Benfica **855**, Porto **727** dönem kaydıyla geldi ve
üçü de `db:verify`'ın zorunlu kulüp listesine eklendi — genişlemenin var olma
sebebi bu üç kulüptü, gelmezlerse genişleme işe yaramamış demektir.

**Paket boyutu ölçüldü, sınır sorun değil.** Veritabanı 90 MB → **100 MB**
(+%11); fonksiyon paketi sınırı 250 MB ve mevcut kullanım 125,4 MB (§10.2).
Beklenenden küçük çıkmasının sebebi ölçülebilir: iki lig birlikte dönemlerin
yalnızca **%10,2**'sini getiriyor, çünkü oyuncuların çoğu zaten evrende vardı
— Ajax'tan Barcelona'ya giden bir oyuncu yeni bir oyuncu değil, yeni bir
DÖNEM.

**İki düzeltme yeni ligde hemen işe yaradı.** Ölçüm sırasında `Sporting CP`
sorgudan dört kez dönüyordu; §5.3'ün ikiz birleştirmesi dördünü **tek kulübe**
indirdi (`Q75729`, 700 dönem). Kısa ad çakışması 3'ten 4'e çıktı ve ayırt
edici ad geçişi dördünü de açtı — `db:verify`'da "aynı görünen seçilebilir
kulüp: **0**".

> **Izgara havuzu genişlemedi ve bu bilinçli.** Küratörlü 82 kulüp bir ÜRÜN
> KARARIDIR (§9.1); Ajax, Porto ve Benfica ortak oyuncu modunda çıkar ama
> ızgara kriteri ve günün oyuncusu havuzu değişmedi. Havuza eklenmeleri ürün
> sahibinin kararıdır, ETL'in değil.

#### İkinci genişleme: "Avrupa-1" paketi

Dört lig daha eklendi. Seçim ürün sahibinindi; adaylar ölçülerek sunuldu.

**`P2094` üst lig demek DEĞİL — bu ölçüm otomasyonu kapattı.** Aday ligleri bir
Wikidata özelliğinden türetmek denendi: hem `P3983` (lig seviyesi) hem `P2094`
(yarışma sınıfı). Birincisi hiç sonuç vermedi, ikincisi **Serie D, Serie C ve
Segunda División'ı** üst lig olarak döndürdü. Wikidata'da "birinci lig"i tek bir
özellikten okumak mümkün değil; bu yüzden lig listesi ızgara havuzu gibi
**küratörlü** kalır ve her QID tek tek doğrulanır.

| QID         | Lig                   | Doğrulama sorgusu | Çekim sorgusu |
| ----------- | --------------------- | ----------------- | ------------- |
| `Q14377162` | İskoçya Premier Ligi  | 13                | 15            |
| `Q216022`   | Belçika Birinci Ligi  | 31                | 36            |
| `Q235114`   | Yunanistan Süper Ligi | 14                | 21            |
| `Q202699`   | İsviçre Süper Ligi    | 15                | 29            |

Amiral kulüpler tek tek doğrulandı (Celtic, Rangers, Aberdeen / Anderlecht,
Club Brugge, Standard, Genk / Olympiakos, Panathinaikos, AEK, PAOK / Basel,
Young Boys, Zürich, Servette) ve QID'leri **ligin kulüp listesinden okundu**.

**Sonuç:** 449 → **551 kulüp**, 84.800 → **95.454 oyuncu**, 245.997 →
**286.533 dönem**. `dev.db` 100 → **115 MB**; tahmin +15 MB idi (101 kulüp ×
ölçülen 0,15 MB), gerçek +15 MB. Rangers **1.021**, Celtic **984** dönem.

**Bir ölçek kusuru ilk kez burada patladı.** `club-duplicates` sorgusu tüm
kulüp QID'lerini tek `VALUES` bloğuna koyuyordu; kulüp evreni 617'ye çıkınca
`HTTP 414: Request-URI Too Large` ile düştü. Sınır yeni değildi — oyuncu
sorguları zaten aynı sebeple 250'lik yığınlarda soruluyor (500'de 414, §5.3).
Sorgu yığınlandı. Yığınlama burada güvenli ve bu tesadüf değil: sorgu her
kulübü BAĞIMSIZ değerlendiriyor, `?parent` ucu `VALUES` ile sınırlı değil.

> **Kusur 6 ligde görünmezdi ve 8 ligde de görünmedi.** Ölçek kusurları
> yalnızca ölçek büyüyünce ortaya çıkar; bu, kapsamı yayından ÖNCE
> genişletmenin somut kazancıdır.

#### Üçüncü genişleme: "Avrupa-2" paketi

Yedi lig daha: Rusya, Polonya, Çekya, Hırvatistan, Danimarka, İsveç, Norveç.
QID'ler ve 14 amiral kulüp ölçülerek doğrulandı (Zenit, Spartak, CSKA / Legia,
Lech / Sparta, Slavia / Dinamo Zagreb, Hajduk / Brøndby, Midtjylland / Malmö,
AIK / Rosenborg, Molde).

**Tahmin bu kez tuttu ve tutması bir şey kanıtlıyor.** İlk iki genişlemeden
kalibre edilen katsayı (~0,15 MB/kulüp) +29 MB dedi, gerçek **+30 MB** oldu.
İki ölçümden çıkarılan bir katsayı üçüncüsünü öngördü; artık kalan paketler
için tahmin değil **hesap** var.

|          | 6 lig   | 8 lig   | 12 lig  | **19 lig**  |
| -------- | ------- | ------- | ------- | ----------- |
| Kulüp    | 383     | 449     | 551     | **806**     |
| Oyuncu   | 76.757  | 84.800  | 95.454  | **120.990** |
| Dönem    | 220.058 | 245.997 | 286.533 | **362.500** |
| `dev.db` | 90 MB   | 100 MB  | 115 MB  | **145 MB**  |

**Paket marjı artık dar ve bu §10.2'ye yazıldı.** Fonksiyon paketi ≈ 145 MB
veri + ~43 MB Prisma motoru + ~5 MB kod = **~193 MB / 250 MB**, yani marj
**1,30 kat**. 125,4 MB'deki "~2 kat" ifadesi artık geçersiz. Kalan aday
paketler (Amerika ~42 MB, Asya ~22 MB) bu marjı **yer**; bir sonraki genişleme
kararı önce §10.2'nin "ETL'e özgü sütun + indeks düşürülür (~20 MB)" satırını
uygulamayı gerektirebilir.

**Vikipedi katmanı yeni liglerde de çalışıyor** ve katkısı ölçüldü: Polonya
%23,0 · Hırvatistan %21,6 · Danimarka %20,5 · Norveç %17,2 · Çekya %15,5 ·
Rusya %14,1 · İsveç %6,3. İsveç'in düşüklüğü kaynak kaynaklı: Allsvenskan'ın
71 kulübünün yalnızca 50'si seçilebilir eşiğini geçiyor.

**İki ikiz koşudan SONRA çözüldü.** Malmö ve Rosenborg'un Wikidata'da ikiz
varlıkları vardı ve hangisinin asıl kalacağına §5.3 dönem sayısına bakarak
karar veriyor. Bu yüzden ikisi `db:verify` kapısına önce KONMADI — tahmin
edilen bir QID kapının kendisini kırılgan yapardı. Koşudan sonra ölçüldü
(`Q204881` Malmö FF 652 dönem, `Q186785` Rosenborg 418) ve öyle eklendi.

#### Dördüncü genişleme: "Avrupa-3" ve genişlemenin SINIRI

Avusturya, Ukrayna, Romanya. Beş aday vardı; Sırbistan ve İsrail **ürün sahibi
kararıyla dışarıda bırakıldı** çünkü paket marjını 1,15 kata düşürüyorlardı.

|             | 6 lig   | 12 lig  | 19 lig  | **22 lig**  |
| ----------- | ------- | ------- | ------- | ----------- |
| Kulüp       | 383     | 551     | 806     | **932**     |
| Oyuncu      | 76.757  | 95.454  | 120.990 | **128.308** |
| Dönem       | 220.058 | 286.533 | 362.500 | **392.560** |
| `dev.db`    | 90 MB   | 115 MB  | 145 MB  | **157 MB**  |
| Paket marjı | —       | 1,54    | 1,30    | **1,22**    |

**Aynı tuzak üçüncü kez.** Avusturya ve Ukrayna bir önceki turda İngilizce ada
göre arandı ve bulunamadı; ülke üzerinden arandıklarında ölçüm yine aynı şeyi
gösterdi: Ukrayna'nın en çok kulüplü ligi **İkinci Lig** (110 kulüp), üst lig
değil. Lig seçiminde ne ada ne sayıya güvenilir — her QID doğrulanır.

**İki ligde etiket denetimi zayıf ve bu telafi edildi.** Doğrulama sorgusu
`Q219592` için yalnızca "Bundesliga", `Q206073` için yalnızca "Premier
League" döndürüyor — ikisi de başka liglerle aynı dizgi. Etiket kimliği tek
başına taşıyamadığı için kulüp eşiği 12'den **20**'ye çıkarıldı: yanlış bir
varlık iki denetimi birden geçemez.

**Avrupa genişlemesi burada durdu ve sebebi ölçüldü.** Kalan adaylar (Amerika
~42 MB, Asya ~22 MB, Sırbistan+İsrail ~8 MB) mevcut marjı yer. Bir sonraki tur,
önce §10.2'nin sıkıştırma satırını uygulamayı gerektirir; **o satırın değeri de
ölçüldü**: `spells_wikidataStatementId_key` indeksi tek başına **20,5 MB** ve
uygulama o sütunu çalışma anında hiç okumuyor (dbstat ölçümü).

> **Bu paragraftaki "Amerika ~42 MB" bir TAHMİNDİ ve sonradan ÖLÇÜMLE ÇÜRÜDÜ**
> — beşinci genişlemeye bakınız. Katsayı (~0,15 MB/kulüp) Avrupa liglerinde
> kalibre edilmişti; genç ve sığ liglere uygulanamıyor. Paragraf, o günkü
> kararın gerekçesini gösterdiği için olduğu gibi bırakıldı.

#### Beşinci genişleme: Avrupa dışına ilk çıkış (MLS, Suudi Pro Lig)

İlk kez Avrupa dışına çıkılıyor. Karar, dördüncü turun "kalan adaylar marjı
yer" sonucuna rağmen verildi çünkü **o sonuç katsayıya, bu tur doğrudan
ölçüme dayanıyor**.

QID'ler yine aramayla bulundu, ezberden yazılmadı: `Q18543` (Major League
Soccer), `Q255633` (Saudi Pro League).

**Evren, ETL'in kendi sorgularıyla ölçüldü** (üç kulüp kaynağı, `P54`
ifadeleri):

|               | Kulüp  | Aday oyuncu | Dönem     |
| ------------- | ------ | ----------- | --------- |
| MLS           | 35     | 3.838       | 6.127     |
| Suudi Pro Lig | 27     | 2.397       | 3.721     |
| **Birleşik**  | **62** | **6.209**   | **9.848** |

**Maliyet neden bu kadar düşük — iki ölçülmüş sebep.** Birincisi, aday
oyuncuların **%30,3'ü zaten veritabanında** (1.884 kişi: Avrupa'da oynayıp
sonra gitmiş olanlar), yani gerçekten yeni olan 4.325. İkincisi, bu ligler
sığ: kulüp başına **159 dönem** taşıyorlar, Avrupa ortalaması **421**.

**Tahmin yöntemi değişti ve önce geriye dönük sınandı.** Kulüp başına katsayı
yerine `dbstat`'tan ölçülen satır maliyeti kullanıldı (oyuncu 203 B, dönem
350 B). Yöntem dördüncü tura uygulandığında 7.318 oyuncu + 30.060 dönem için
**12,0 MB** dedi; o turun gerçek büyümesi **12 MB** idi. Aynı yöntem bu tur
için **4,1 MB** diyor (Vikipedi katmanının ölçülen %18,6 katkısıyla ~5 MB).

**Kapsam metni değişti ve bu bir ürün kararıdır.** Site altı yerde "yalnızca
kapsanan yirmi iki **Avrupa** ligi" diyordu. Artık lig sayısı **yirmi dört**
ve **Avrupa nitelemesi düştü**; niteleme kalsaydı kullanıcıya yanlış bir
kapsam vaadi verilirdi (§1.3'ün varlık sebebi bu vaadin doğru olması).

**MLS iki ülkeli ve bu kabul edildi.** `League.country` tek alan; Toronto,
Vancouver ve Montréal Kanada'da. Kulüp ülkeleri `P17`'den geldiği için kulüp
düzeyinde doğru kalır, yalnızca lig satırı "US" der. Ligi ikiye bölmek ya da
alanı çoğullaştırmak, tek bir görüntüleme etiketi için veri modelini
karmaşıklaştırırdı.

**Ölçülen sonuç.**

|             | 19 lig  | 22 lig   | **24 lig**   |
| ----------- | ------- | -------- | ------------ |
| Kulüp       | 806     | 932      | **992**      |
| Seçilebilir | —       | 850      | **906**      |
| Oyuncu      | 120.990 | 128.308  | **132.263**  |
| Dönem       | 362.500 | 392.560  | **405.418**  |
| `dev.db`    | 145 MB  | 156,3 MB | **161,4 MB** |
| Paket marjı | 1,30    | 1,22     | **1,19**     |

Tahmin **4,1 MB** (Vikipedi katkısıyla ~5), gerçek **+5,1 MB**. Kulüp tahmini
62, gerçek 60. Oyuncu tahmini 4.325, gerçek 3.955. Dönem tahmini 9.848, gerçek
**12.858** — fark Vikipedi katmanından geliyor ve zaten öngörülmüştü; satır
maliyeti yöntemi yalnızca Wikidata'nın `P54` ifadelerini sayabiliyor.

**Denetim, tasarımcısını da yakaladı.** İlk yazımda `verifyLabel`
gerekmeyeceği varsayıldı; gerekçe "etiketler başka ligle çakışmıyor" idi.
Denetim ise çakışmaya değil, Wikidata etiketinin GÖSTERİLEN ADLA eşleşmesine
bakar — adlar Türkçeleştirildiği için ("MLS", "Suudi Pro Lig") doğrulama
haklı olarak düştü:

    ✗ Q18543: "Major League Soccer" — beklenen "MLS"
    ✗ Q255633: "Saudi Pro League" — beklenen "Suudi Pro Lig"

İkisine de `verifyLabel` eklendi. Kayda değer olan, hatanın kod yazılmadan
önce değil, **kapıda** yakalanmış olması: varsayım belgeye de geçmişti ve
belge ancak ölçüm onu çürüttükten sonra düzeltildi.

Üç sütun üç ayrı şeyi sayar ve karıştırılmamalıdır:

- **Güncel kadro** — ligin bu sezonki takım sayısı.
- **Veri kümesi** — ligde bir zamanlar yer almış ve veritabanına giren tüm kulüpler. Ligler tarihseldir: Serie A'da 92 kulüp oynamıştır, 28'i bu sezon.
- **Seçilebilir** — kullanıcıya sunulanlar; en az 50 dönem kaydı olma eşiğini geçenler (§5.3).

Faz 1 sonunda ölçülen toplam: **388 kulüp, 76.358 oyuncu, 193.003 dönem** (19.803'ü kiralık, 9.561'i sürmekte). Kabul kontrolü `npm run db:verify` ile tekrarlanabilir.

QID'ler ve kulüp sayıları Faz 1'de canlı SPARQL sorgusuyla **ölçülerek doğrulandı** (2026-07-29). Ölçüm üç hata ortaya çıkardı ve üçü de düzeltildi:

- Süper Lig için ilk tahmin `Q170323` idi; o QID **Nintendo DS**'e ait. Doğrusu `Q485568`.
- Kulüp sayımı `P118` (lig) üzerinden yapılırken tür kısıtı olmadan 9091 sonuç dönüyordu; bunların 6066'sı **insan** çıktı. `P118` yalnızca takımlarda değil oyuncularda da kullanılıyor. Bu yüzden bir tür kısıtı **zorunludur**.
- Tür kısıtı tek sınıfa (`Q476028`) daraltıldığında ise **FC Barcelona listeden düşüyordu**: Barcelona'nın `P31` değerleri `men's association football team`, `professional sports team` ve `representation team`; hiçbiri `Q476028` değil. Aynı hata Bundesliga'yı 18 yerine 17, Süper Lig'i 20 yerine 19 kulüple gösteriyordu. Doğru çözüm, ölçülerek çıkarılmış **6 sınıflık bir beyaz liste** kullanmaktır (§5.3).

> Sayılar zamanla değişir. `P118` tarihsel bir bağ olduğu için feshedilmiş selef kulüpler de (ör. `SC Fives`, `Olympique Lillois`, `Società Ginnastica di Torino`) listeye girer. Bunlar `Club.isSelectable = false` ile seçim listesinden çıkarılır: eşik, en az 50 dönem kaydı olmasıdır. Aksi hâlde kullanıcı bu kulüpleri seçip boş sonuç alırdı. Hiç dönem kaydı gelmeyen kulüpler ise yükleme sonunda tamamen silinir (bu koşuda 34 adet).

Bu kulüplerin **tüm tarihsel kadroları** çekilir (yalnızca güncel sezon değil) — Barcelona 1491, Bayern 804, Galatasaray 735 dönem kaydı gibi.

**Kapsam sınırı (Faz 1 kararı):** Yalnızca bu kulüplerdeki dönemler çekilir; oyuncuların bu kulüpler dışındaki kariyerleri **çekilmez**. MVP oyun modu için bu yeterlidir ve tam olarak doğrudur: "A ve B kulüplerinin ikisinde de oynamış oyuncular" sorusu, A ve B seçilebilir kulüpler olduğu için yalnızca bu dönemlere bakar. Veri kümesi ayrıca erkek ligleriyle sınırlıdır (BR-7).

**Kapsam arayüzde bildirilir (Faz 4 kararı).** Kullanıcı Ajax, Porto, Benfica veya Celtic arayınca hiçbir şey bulamayacak. Bu bir hata değil, yukarıdaki kapsam kararıdır — ama söylenmezse kullanıcı siteyi **bozuk** sanır. Bir ürünün kapsamı, kullanıcının onu keşfetmek için başarısız aramalar yapmasına bırakılamaz: hangi liglerin kapsandığı arayüzde açıkça yazar ve sonuçsuz aramada tekrar hatırlatılır. Aynı gerekçe veri güncellik tarihi için de geçerlidir (§8.3): veri yılda iki kez tazelendiği için eksik bir transferi gören kullanıcı, verinin ne zaman çekildiğini görebilmelidir.

Tam kariyer çıkarımı (oyuncunun geçtiği her kulüp) Faz 5'teki **kariyer bilmecesi** ve **bağlantı zinciri** modlarının ön koşuludur; oraya kadar ertelendi (§10.2). Ertelemenin gerekçesi kapsam disiplinidir: tam kariyer çekimi kulüp evrenini birkaç bine çıkarır ve MVP'ye hiçbir doğruluk katkısı yapmaz.

### 1.4 Başarı Kriterleri

- Bilinen kulüp çiftlerinden oluşan doğrulama setinde **≥ %95 isabet** (bilinen ortak oyuncuların ≥ %95'i bulunuyor). **Durum: karşılanıyor** — elle doğrulanmış 31 olgunun 31'i bulunuyor.

- Kanıtı eksik olan hiçbir kayıt, kanıtlı bir kayıtmış gibi sunulMAZ. **Durum: BR-8 ile karşılanıyor** (aşağıdaki ölçüm).

  > **Neden "yanlış pozitif sıfır" değil.** İlk yazımda ölçüt "yanlış pozitif bulunmaz" idi. Faz 4'te ölçüldü ve bu ölçütün **bu veri kaynağıyla ulaşılamaz** olduğu görüldü; ölçüt, ulaşılabilir ve denetlenebilir olanla değiştirildi.
  >
  > Dönemlerin %11,7'si tarihsiz ve maçsızdır (193.003'ün 22.520'si). Bunları elemek denendi ve üç aday kural ölçüldü — üçü de altın setin 31/31'ini koruyor, yani ilk bakışta bedelsiz görünüyor. Ama altın set yalnızca **ünlü** oyuncu içerir; bedeli göremez. Düşen isimlere bakıldığında bedel ortaya çıktı:
  >
  > | Düşen oyuncu               | Kayıt                   | Gerçekte                        |
  > | -------------------------- | ----------------------- | ------------------------------- |
  > | Bill Dale (`Q4908654`)     | Man Utd + Man City      | **Doğru** — ikisinde de oynadı  |
  > | Harry McShane (`Q48724`)   | Man Utd + Man City      | **Doğru** — ikisinde de oynadı  |
  > | Emmanuel Petit (`Q269883`) | Barcelona + Real Madrid | **Yanlış** — Real Madrid'de yok |
  > | Manuel Sanchís (`Q776310`) | Barcelona + Real Madrid | **Yanlış** — Barcelona'da yok   |
  >
  > Eleme, yanlışlarla birlikte doğruları da siliyor: Man Utd ∩ Man City 76 → 52, Barcelona ∩ Real Madrid 49 → 36 (yaklaşık üçte bir kayıp).
  >
  > Ardından Wikidata'da ayırt edici bir sinyal arandı — ifade `rank`'ı ve kaynakça sayısı canlı sorguyla okundu. **Yok:** rank hepsinde `NormalRank`; kaynakça ise ters yönde çalışıyor (uydurma Petit kaydının kaynağı var, doğru Bill Dale kaydının yok). Nitelik sayısı da yeni bilgi taşımıyor — tarihler ve maç sayıları zaten nitelik olarak geliyor, yani "nitelik=0" bizim hâlihazırda bildiğimiz şeyin aynısı.
  >
  > Elemek doğruyu siler, tutmak yanlışı gösterir, veri ikisini ayırmaz. Bu durumda tek dürüst davranış **etiketlemektir** (BR-8): kayıt kalır, kanıtının eksik olduğu kullanıcıya görünür. §2'nin 7. ilkesi — "belirsizlik veri kaybından iyidir" — bunu zaten söylüyordu. Oran bir testle izlenir ve sessizce büyüyemez (§8.2).

- Ortak oyuncu sorgusu **p95 < 150 ms** (sunucu tarafı). **Durum: karşılanıyor** — `npm run bench` ile ölçülüyor, son ölçüm p95 16,8 ms.
- İlk anlamlı içerik (LCP) **< 2.0 s** (yavaş 4G, orta seviye cihaz).
- Bilinen kritik/yüksek seviye güvenlik açığı **sıfır** (`npm audit`, bkz. §7).

---

## 2. Mühendislik İlkeleri

Bu proje aşağıdaki ilkelere bağlıdır. Bir kod değişikliği bu ilkelerden birini ihlal ediyorsa reddedilir.

1. **Bağımlılık yönü içe doğrudur.** `domain` hiçbir şeye bağımlı değildir. `application` yalnızca `domain`'e bağımlıdır. `infrastructure` ve `app` (UI) dışarıdadır. Prisma tipi, React tipi veya `next/*` importu `domain/` içinde **asla** yer almaz.
2. **Dış dünya sorgu anında değil, çevrimdışı okunur.** Wikidata'ya yalnızca ETL sürecinde bağlanılır. Kullanıcı isteği hiçbir zaman üçüncü taraf bir servise gitmez. (Hem güvenlik hem performans gerekçesi — bkz. §7.4.)
3. **Sınırlarda doğrulama.** Sisteme giren her veri (HTTP query, ETL yanıtı, ortam değişkeni) Zod şeması ile ayrıştırılır. Ayrıştırılmamış veri iç katmanlara geçemez.
4. **Veritabanı satırı ≠ API yanıtı.** Dışarı her zaman açıkça tanımlanmış bir DTO döner. `select *` benzeri "ne varsa gönder" davranışı yoktur.
5. **Tip güvenliği tavizsizdir.** `strict: true`, `noUncheckedIndexedAccess: true`. `any` kullanımı lint hatasıdır; kaçınılmazsa gerekçesi yorumla yazılır.
6. **Her iş kuralının testi vardır.** Ortak oyuncu bulma mantığı, tarih çakışması, kiralık ayrımı — hepsi birim testi ile korunur.
7. **Belirsizlik veri kaybından iyidir.** Wikidata'da tarihi eksik bir kayıt uydurulmaz; `null` olarak taşınır ve arayüzde "tarih bilinmiyor" şeklinde gösterilir.

---

## 3. Teknoloji Yığını

| Katman        | Seçim                       | Gerekçe                                                                 |
| ------------- | --------------------------- | ----------------------------------------------------------------------- |
| Dil           | TypeScript 5 (strict)       | Derleme zamanı güvence, geniş ekosistem                                 |
| Çatı          | Next.js 16 (App Router)     | Sunucu tarafı veri erişimi; sır (secret) istemciye hiç inmez            |
| UI            | React 19 + Tailwind CSS 4   | Otomatik XSS kaçışı, hızlı ve tutarlı stil                              |
| Veritabanı    | SQLite (salt-okunur)        | Üretimde yazılmaz; dağıtım paketine gömülür (§3.1)                      |
| ORM           | Prisma 6                    | Parametreli sorgu (SQL injection'a karşı yapısal koruma), tipli şema    |
| Doğrulama     | Zod 4                       | Şemadan tip türetme; tek kaynaktan hem runtime hem compile-time güvence |
| Test          | Vitest 4                    | Hızlı, Vite tabanlı; UI testleri için Faz 3'te Testing Library eklenir  |
| Lint / Format | ESLint 9 + Prettier 3       | Tutarlı kod tabanı, otomatik kural denetimi                             |
| ETL           | Node.js CLI (`scripts/etl`) | Web sürecinden tamamen ayrık; ağ erişimi yalnızca burada                |
| Barındırma    | Vercel (sunucusuz)          | Sıfır operasyon; CDN önbelleği yerleşik                                 |
| Zamanlama     | GitHub Actions (cron)       | ETL'in çalıştığı yer; istek yoluyla hiç kesişmez                        |

> **Next.js 16 notu:** `middleware.ts` dosya kuralı **`proxy.ts`** olarak yeniden adlandırıldı ve dışa aktarılan fonksiyonun adı `proxy` olmalıdır. Sürüme özgü API'ler için `node_modules/next/dist/docs/` altındaki gömülü dokümantasyon esas alınır — eğitim verisinden hatırlanan eski API'ler değil.

### 3.1 Dağıtım Mimarisi: veri bir derleme çıktısıdır

Bu projenin belirleyici kısıtı şudur: **veri yılda iki kez, transfer dönemleri kapandıktan sonra güncellenir.** Kullanıcı isteği veritabanına asla yazmaz. Bu kısıt mimariyi büyük ölçüde tek başına belirliyor.

```
GitHub Actions  (cron: yılda 2 kez + elle tetik)
  │
  ├─ npm run etl        Wikidata → SQLite dosyası  (~55 dk)
  ├─ npm run db:verify  KAPI: geçmezse burada durur
  └─ dosyayı yayımla  →  Vercel dağıtımı
                          └─ .db fonksiyon paketinde, SALT-OKUNUR
                             └─ istek → Prisma → yerel dosya (ağ turu yok)
```

**Neden bu şekil:**

- **Bozuk veri kullanıcıya ulaşamaz.** `db:verify` geçmezse yeni dağıtım hiç oluşmaz; site bir önceki veriyle çalışmaya devam eder. Canlı bir veritabanına yazan ETL'de bu güvence yoktur — hatalı koşu doğrudan üretime yazar.
- **Geri alma dağıtımı geri almaktır.** Veri ve kod birlikte sürümlenir; bir önceki dağıtıma dönmek bir önceki veriye dönmektir.
- **Sorgu ağ turu içermez.** Ayrı bir veritabanı sunucusu her sorguya gidiş-dönüş ekler; bizim sorgumuz iki ardışık turdan oluştuğu için bu sabit bir vergi olurdu.
- **Yönetilecek sır yok.** Veritabanı kimlik bilgisi, bağlantı dizesi, ağdan erişilebilen SQL yüzeyi — hiçbiri yok.

**Neden Postgres değil (ölçüldü).** Sunucusuz ortamda dosya sisteminin salt-okunur olması ilk bakışta SQLite'ı eler. Ölçüm bunun yalnızca **yazma** için doğru olduğunu gösterdi: Prisma salt-okunur bir SQLite dosyasını sorunsuz açıyor, en ağır çift (Milan ∩ Inter, 128 oyuncu) salt-okunur dosyadan 18,4 ms'de dönüyor ve yazma denemesi işletim sistemi düzeyinde reddediliyor. Yazma yolu olmadığı için Postgres'in çözdüğü problemlerin — eşzamanlı yazma, bağlantı havuzu, çok yazarlı tutarlılık — hiçbiri bu projede yok.

**Bilinen sınır — ölçüldü.** Fonksiyon paketinin tamamı izlendi (`*.nft.json`), veritabanı tek başına değil:

| Bileşen        | Boyut        | Pay                      |
| -------------- | ------------ | ------------------------ |
| Veritabanı     | 78,4 MB      | %62                      |
| Prisma motoru  | 42,5 MB      | %34                      |
| Uygulama kodu  | 3,2 MB       | %3                       |
| `node_modules` | 1,4 MB       | %1                       |
| **Toplam**     | **125,4 MB** | Vercel sınırı **250 MB** |

Yani marj yaklaşık iki kat — "bol" değil ama yeterli. Veritabanı yayına çıkmadan VACUUM'lanıyor (78,4 → 72,8 MB), dolayısıyla üretimdeki paket ~120 MB.

**Büyümeye karşı elde ne var.** `spells.wikidataStatementId` sütunu ve benzersizlik indeksi (~20 MB) yalnızca ETL'in idempotanlığı için gerekli; uygulama hiç okumuyor. Sınıra yaklaşılırsa yayına çıkan kopyadan bu ikisi düşürülür. O da yetmezse Postgres'e geçiş `PlayerRepository` port'unun arkasında kalır (§4.1) ve tek uygulama dosyasını etkiler — ki bu durumda Prisma motorunun 42,5 MB'ı da ortadan kalkmaz ama veritabanı payı sıfırlanır.

**Ne zaman değişir.** Skor tablosu (§9) yazma ve kimlik getirir; o zaman gerçek bir veritabanı gerekir. Ama bu **ayrı bir veri kümesidir** — kullanıcı skorları quiz verisiyle aynı yerde durmak zorunda değil ve bu mimariyi bozmaz.

#### Parçalar ve sorumlulukları

| Parça                                | Ne yapar                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `.github/workflows/data-refresh.yml` | ETL → `db:verify` → `bench` → VACUUM → sürüm varlığı → dağıtım tetiği           |
| `scripts/fetch-dataset.ts`           | Derleme öncesi veri kümesini indirir; inmezse derlemeyi DURDURUR                |
| `npm run vercel-build`               | `dataset:fetch` → `prisma generate` → `next build`                              |
| `outputFileTracingIncludes`          | `.db`'yi sunucu paketine dâhil eder — yol üzerinden açıldığı için izlenemiyor   |
| `resolveDatabaseUrl()`               | Göreli yolu çalışma zamanında mutlaklaştırır; Prisma'nın şema-göreli çözümü yok |

Bunların ikisi yerelde ölçüldü: iz dosyaları (`*.nft.json`) `.db`'yi içeriyor ve çözülen yol gerçek dosyaya denk geliyor. Kalanlar — cron tetikleme, sürüm varlığı, dağıtım kancası — **ilk dağıtımda doğrulanacaktır** (Faz 4.5); GitHub ve Vercel bağlanmadan ölçülemezler.

> **Ölçülmüş tuzak.** İlk `outputFileTracingIncludes` kalıbı `prisma/*.db` idi ve yanına bırakılmış bir yedeği (`dev.db.bak`) de pakete aldı. Kalıp tek dosyayı adlayacak biçimde daraltıldı: 73 MB'lık bir dosyanın kazara ikizlenmesi paket sınırını sessizce tüketir.

---

## 4. Mimari

### 4.1 Katmanlar

```
┌─────────────────────────────────────────────────────┐
│  app/  — Next.js sayfaları, route handler'lar, UI    │  dışarıya bakan yüz
├─────────────────────────────────────────────────────┤
│  application/  — use-case'ler, port (arayüz) tanımı  │  senaryolar
├─────────────────────────────────────────────────────┤
│  domain/  — varlıklar, değer nesneleri, iş kuralları │  saf çekirdek
└─────────────────────────────────────────────────────┘
        ▲
        │ port'ları uygular (dependency inversion)
┌─────────────────────────────────────────────────────┐
│  infrastructure/  — Prisma repo'ları, cache, config  │
└─────────────────────────────────────────────────────┘
```

`application` katmanı bir **port** (TypeScript arayüzü) tanımlar; `infrastructure` bunu uygular. Böylece iş mantığı testlerde gerçek veritabanı olmadan çalışır ve veri kaynağı değişse bile çekirdek kod değişmez.

### 4.2 Klasör Yapısı

```
futbol-quiz/
├── PROJECT.md                     ← bu belge
├── README.md                      ← kurulum ve çalıştırma
├── .env.example                   ← gerçek .env asla commit edilmez
├── .gitignore
├── next.config.ts                 ← sabit güvenlik başlıkları + görsel beyaz listesi
├── tsconfig.json
├── eslint.config.mjs              ← katman sınırı + güvenlik lint kuralları
├── vitest.config.ts
├── .prettierrc.json
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── dev.db                     ← git'e girmez
│
├── scripts/etl/                   ← ağa çıkan TEK yer
│   ├── index.ts                   ← CLI giriş noktası
│   ├── verify-data.ts             ← yükleme sonrası kabul kontrolü (§8.2)
│   ├── config.ts                  ← Zod ile doğrulanmış ETL ortamı
│   ├── leagues.ts                 ← doğrulanmış lig QID'leri ve WD sabitleri
│   ├── sources/
│   │   ├── http.ts                ← ortak taşıma: rate-limit + retry + önbellek
│   │   ├── wikidata/
│   │   │   ├── client.ts          ← SPARQL istemcisi (taşımanın üzerinde)
│   │   │   ├── queries.ts         ← parametreli SPARQL kurucuları (QID guard'lı)
│   │   │   └── schemas.ts         ← gelen yanıtın Zod şeması + okuyucular
│   │   └── wikipedia/             ← §4.3 ikinci kaynak
│   │       ├── client.ts          ← wikitext + yönlendirme takma adları
│   │       └── infobox.ts         ← bilgi kutusu ayrıştırıcısı, 5 dil (SAF)
│   ├── pipeline/
│   │   ├── extract.ts             ← beş geçişli çekim orkestrasyonu
│   │   ├── normalize.ts           ← ad/tarih normalizasyonu, dedupe
│   │   ├── merge-clubs.ts         ← §5.3 kulüp ikizlerini birleştirir (SAF)
│   │   ├── club-labels.ts         ← §5.3 seçicide ayırt edilebilir kısa ad (SAF)
│   │   ├── wikipedia-pass.ts      ← bilgi kutularını çek, ayrıştır, eşleştir
│   │   ├── merge-wikipedia.ts     ← §4.3'ün altı birleştirme kuralı (SAF)
│   │   ├── validate.ts            ← tutarlılık denetimleri
│   │   └── load.ts                ← veritabanına upsert
│   └── .cache/                    ← ham yanıtlar; git'e girmez
│
├── src/
│   ├── domain/
│   │   ├── entities/              ← Player, Club, Spell
│   │   ├── value-objects/         ← ClubId/PlayerId (markalı), YearRange,
│   │   │                            Season (BR-6), SearchKey (TR normalizasyon)
│   │   ├── services/              ← spellQualifies (BR-2/3), findCommonPlayers
│   │   │                            (BR-1/5) — hepsi saf fonksiyon
│   │   └── errors/                ← DomainError hiyerarşisi (§6.3 kodları)
│   │
│   ├── application/
│   │   ├── ports/                 ← ClubRepository, PlayerRepository arayüzleri
│   │   ├── use-cases/
│   │   │   ├── search-clubs.ts
│   │   │   └── find-common-players.ts
│   │   ├── dto/                   ← dışarı dönen şekiller
│   │   └── game-modes/            ← oyun modu kaydı (§9)
│   │
│   ├── infrastructure/
│   │   ├── db/
│   │   │   ├── client.ts          ← tekil PrismaClient
│   │   │   └── repositories/      ← port uygulamaları + kompozisyon kökü
│   │   ├── cache/                 ← LRU bellek içi önbellek
│   │   ├── rate-limit/            ← token bucket
│   │   └── config/env.ts          ← Zod ile doğrulanmış ortam değişkenleri
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               ← ortak oyuncu ekranı
│   │   ├── error.tsx              ← kullanıcıya sızıntısız hata ekranı
│   │   └── api/
│   │       ├── clubs/route.ts
│   │       └── common-players/route.ts
│   │
│   ├── components/                ← sunum bileşenleri (iş mantığı yok)
│   │   ├── club-picker.tsx        ← ARIA combobox, klavye gezinme
│   │   ├── common-players-quiz.tsx← durum makinesi (istemci)
│   │   └── common-players-result.tsx
│   │
│   └── lib/                       ← saf yardımcılar
│       ├── trace-id.ts            ← §6.3 iz kimliği
│       ├── logger.ts              ← ayrıntı LOGA, kimlik YANITA
│       └── http/
│           ├── api-error.ts       ← DomainError → §6.3 kodu ve durumu
│           └── api-handler.ts     ← tüm uçların ortak sarmalayıcısı
│
└── tests/
    ├── unit/                      ← domain + application — veritabanı yok
    ├── integration/               ← repo'lar — geçici SQLite, migrate deploy
    ├── golden/                    ← gerçek veri kümesi; DB yoksa atlanır
    ├── fixtures/                  ← elle doğrulanmış olgular (§8.1)
    └── helpers/                   ← kurucular, sahte port'lar, test DB'si
```

### 4.3 Kaynak Sözleşmesi — Wikidata + Vikipedi

**Neden iki kaynak.** Wikidata'nın kapsam boşluğu ölçüldü ve kabul edilemez çıktı: Galatasaray'ın güncel kadrosunun 13/24'ü, Trabzonspor'un 5/15'i veri kümesinde yoktu (§8.2). Boşluk bir süre elle kapatıldı; o mekanizma **kaldırıldı**, çünkü her tazelemede insan emeği gerektiriyordu ve kendini güncelleyen bir sistemle bağdaşmıyordu.

Boşluk artık ikinci bir **kaynakla** kapanıyor: Vikipedi bilgi kutuları. Aynı ekosistem, aynı özgür lisans, sıfır maliyet — ama farklı bir katman. Vikipedi'yi **insanlar** yazıyor ve maç sonrası güncelliyor; Wikidata'ya aktarım ayrı, gönüllü ve düzensiz bir iş. Sorgulanabilir olanı okuyorduk, insanların yazdığını değil.

#### Rollerin ayrımı

|           | **Wikidata**                                                       | **Vikipedi**                                |
| --------- | ------------------------------------------------------------------ | ------------------------------------------- |
| Rol       | Yapılandırılmış **omurga**                                         | **Tamamlayıcı** katman                      |
| Sağladığı | QID kimlikleri, kulüp evreni, oyuncu meta verisi, ifade kimlikleri | Eksik dönemler, eksik yıl/maç/gol değerleri |
| Okunuş    | SPARQL                                                             | Bilgi kutusu wikitext'i (5 dil, iki kademe) |

**Vikipedi bir üst küme DEĞİL** ve bu ölçüldü: 400 oyunculuk örneklemde Wikidata'da olup Vikipedi bilgi kutusunda olmayan **320–346 kulüp** çıktı. Kaynağı değiştirmek değil, eklemek doğru olan.

#### Eşleştirme

Bir bilgi kutusu kaydı, bir Wikidata dönemiyle **kulüp QID'si** üzerinden eşleşir. Kulüp adı değil QID: ad eşleştirmesi bu projede dört kez yanılttı (§5.3).

**Yön TERSİNE çevrildi ve bu ölçülmüş bir karardır.** İlk tasarım bilgi kutusundaki her bağlantıyı MediaWiki'ye sorup QID'ye çeviriyordu. İki kulüplük denemede 3.250 başlık için 65 istek gerekti ve okunan satırların **%51'i evren dışı** çıktı — yani isteklerin çoğu atılacak veriyi çözmek için harcanıyordu. Şimdi tersi yapılıyor: **evrendeki 423 kulübün** makale adları (SPARQL) ve yönlendirme takma adları (`prop=redirects`) bir kez indekslenir, bilgi kutusundaki bağlantı bu indekste aranır. Ağ maliyeti kulüp sayısıyla sınırlı, oyuncu sayısıyla değil; 5. kural da böylece **yapısal olarak** sağlanır — evren dışı bir kulübü tanımanın yolu kalmaz.

Yönlendirmeler okunmak zorunda: bilgi kutuları kulübe her adıyla bağlanıyor. Ölçüldü — tek başına Konyaspor'un 5 (`Torku Konyaspor`, `Atiker Konyaspor`, `Konya SK`…), Galatasaray'ın 11 takma adı var. İndekste bulunmayan bağlantı **atlanır**, tahmin edilmez.

Aynı kulüpte birden çok dönem varsa (gidip dönen oyuncu) eşleştirme **başlangıç yılına** bakar ve **üç kademelidir**:

1. **Tam yıl** eşleşmesi.
2. Tek aday kaldıysa **±1 yıl** hoşgörüsü (ölçüm: 624 eşleşmede %96,2 birebir, ±1'de %2,8 daha).
3. **Kanıtsız kayıt, kanıtlı okumaya bırakır** (aşağıda).

Hiçbiri tutmuyorsa kayıt yalnızca **aralıklar örtüşmüyorsa** yeni dönem sayılır. Örtüşme belirsizliğin ta kendisidir: aynı dönemin iki kaynaktaki farklı yazımı olabilir ve ikinci bir kopya üretmek §8.2'nin "örtüşen kalıcı dönem" uyarısını tetikler, arayüzde kulüp iki kez görünürdü. Ayrık aralıklar ise tanım gereği farklı dönemlerdir — belirsizlik yok, kayıt eklenir.

##### Üçüncü kademe — kanıtsız kayıt kanıtlı okumaya bırakır

İlk iki kademe bir açık bırakıyordu ve açığı **oyunun kendisi gösterdi**: istatistik modunda Yunus Akgün aranınca bulunamıyordu, ızgarada bulunuyordu.

Sebep zincirle ölçüldü. Wikidata'da Galatasaray dönemi **2008'de** başlıyor ve açık uçlu — oyuncu o tarihte 8 yaşında, yani kayıt akademi girişi. `P3831` altyapı niteleyicisi **yok**, dolayısıyla BR-2 eleyemiyor. Bilgi kutusu doğrusunu yazıyor (2018–, 99 maç 16 gol) ama iki kayıt buluşamıyordu: yıl farkı 10, `±1`'in dışında; 1. kural da ekleyemiyor çünkü 2008–(açık) ile 2018–(açık) örtüşüyor. **Tek bozuk Wikidata kaydı, o kulüpteki bütün düzeltmeyi bloke ediyordu.**

Sonucu oyunda görünüyordu: dönem maçsız kaldığı için oyuncu BR-16 süzgecinden düşüyor ve altı istatistiğin beşinde seçilemiyordu.

Kademe 4. kuralın (**Vikipedi silmez**) sınırında durduğu için koşulları dar:

| Koşul                                   | Gerekçe                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Mevcut dönem maç **ve** gol olarak boş  | Doğrulanabilir hiçbir şey taşımayan kaydın yılları için kayıp yoktur   |
| Vikipedi kaydında maç **veya** gol dolu | Kanıtsızı kanıtsızla değiştirmek kaynağı değiştirir, güveni artırmazdı |
| Aralıklar örtüşüyor                     | Ayrık aralıklar farklı dönemlerdir; 1. kural onları zaten ekliyor      |

Eşleşme kurulduktan sonra `enrich`in dört ölçülmüş güvencesi (yıl çifti, kardeş çakışması, maç/gol çifti, akla yatkın yıl) olduğu gibi işler — kademe yeni bir birleştirme yolu açmıyor, var olanın kapısını genişletiyor.

> **Ölçüm: kural veri kalitesini bozmadı, düzeltti.** Tam koşuda **456 kayıt** kurtarıldı ve iki §8.2 uyarısı da KÜÇÜLDÜ.
>
> | Ölçüt                     | Kademe yokken | Kademeyle |
> | ------------------------- | ------------- | --------- |
> | Kanıtlı okumaya bırakılan | —             | **456**   |
> | Belirsiz eşleşme          | 5.588         | **5.217** |
> | Zenginleşen dönem         | 28.338        | 28.710    |
> | Düzeltilen değer          | 22.862        | 23.279    |
> | Ayıklanan dönem           | 3             | **2**     |
> | Örtüşen kalıcı dönem      | 2.053         | **2.045** |
> | Çakışan yıl reddi         | 454           | 462       |
>
> Son satır güvencenin çalıştığının kanıtı: kademenin 8 kez doğuracağı kardeş çakışmasını `enrich` geri aldı. Dönem sayısı yalnızca +1 arttı — kazanç sayıda değil, **doğrulukta**.

#### Birleştirme kuralları

1. **Eksik dönem eklenir.** O kulüpte hiç Wikidata dönemi yoksa, bilgi kutusu kaydı yeni bir dönem olur.
2. **Var olan dönem zenginleşir.** Wikidata'da alan `null` ise Vikipedi'nin değeri yazılır.
3. **Çelişkide Vikipedi kazanır.** İki kaynak da doluysa ve değerler farklıysa Vikipedi'ninki kullanılır.
4. **Vikipedi asla SİLMEZ.** Wikidata'da olup Vikipedi'de olmayan bir dönem korunur (yukarıdaki 320–346 ölçümü).
5. **Kulüp evrenini Vikipedi belirlemez.** Kapsam dışı bir kulüp (alt lig, yabancı lig) bilgi kutusunda görünse de atlanır; evren §5.3'teki sorgudan gelir.
6. **Altyapı ve millî takım okunmaz.** Yalnızca A takımı alanı okunur — `tr`/`en`'de `kulüpN`/`clubsN`, ana dillerde `Squadre`/`vereine_tabelle`/`parcours senior`. Karşılıkları (`altyapıkulübüN`, `youthclubsN`, `SquadreGiovanili`, `jugendvereine_tabelle`, `parcours junior`, `millitakımN`, `nationalteamN`, `nationalmannschaft_tabelle`, `sélection nationale`) ve teknik direktörlük alanları (`trainer_tabelle`, `SquadreAllenate`) bilerek dışarıda (BR-2).

> **3. kural ölçümle doğrulandı, tercihle değil.** İki risk vardı ve ikisi de sınandı.
>
> **Maç sayıları aynı şeyi mi sayıyor?** Endişe, Wikidata'nın `P1350`'sinin tüm kulvarları, bilgi kutusunun yalnızca ligi sayması ve tercihin sayının ANLAMINI değiştirmesiydi. 738 eşleşen dönemde: **%89 birebir aynı**, Vikipedi düşük %7, yüksek %4, fark ortancası **0**. Fark simetrik, yani kapsam farkı yok. (%89 birebir uyum, Wikidata'nın bu değerleri geçmişte Vikipedi'den robotla almış olmasıyla tutarlı — ayrıştıkları yerde Vikipedi büyük olasılıkla daha yeni olan.)
>
> **Yıllar sezon düzeltmesini geri alır mı?** BR-6 kayması yeni düzeltilmişti; Vikipedi sistematik olarak 1 yıl kaymış olsaydı bu kural düzeltmeyi geri alırdı. 554 belirsizliksiz eşleşmede: **%94,0 tam uyum**, −1 yıl %2,0, +1 yıl %1,8. Simetrik ve dar; sistematik kayma **yok**. Kalan uyuşmazlıkların çoğu savaş yılı kayıtları (Peter Croker: 1946 / 1941). Ayrıştırıcı yazıldıktan sonra aynı ölçüm 624 eşleşmeyle tekrarlandı: **%96,2**.
>
> **Kiralık bayrağı da 3. kurala tabidir.** 660 eşleşmenin %2'sinde iki kaynak ayrışıyor ve ayrışma iki yöne de dağılıyor (8 / 5) — sistematik fark yok. Risk zaten düşük: BR-3'e göre kiralık dönemler **sayılır**, yalnızca rozetle işaretlenir; yanlış bayrak bir rozeti bozar, bir dönemi kaybettirmez.

#### Bitiş yılının okunuşu

Bilgi kutusundaki yıllar tarih değil kariyer aralığıdır ve **iki ucu farklı okunur**. Başlangıç olduğu gibi alınır, bitişten **bir çıkarılır**:

```
| kulüpyıl1 = 2011-2022   Konyaspor    → 2011 … 2021 sezonu
| kulüpyıl8 = 2022-       Galatasaray  → 2022 … (devam ediyor)
```

Bardakçı 2022 yazında Konyaspor'dan ayrılıp Galatasaray'a katıldı; Konyaspor'daki son sezonu 2021/22'dir. Çıkarma, Wikidata'nın yıl hassasiyetli tarihlerine uygulanan kuralın (`seasonYearAt`, BR-6) aynısıdır — iki kaynak aynı ölçeğe indirgenmezse aynı kulüpte biri 2021 biri 2022 biten iki dönem görünür.

> **Çıkarma tahmin değil, ölçüldü.** 471 makalelik korpusta belirsizliksiz 589 bitiş eşleşmesi: bir çıkarılmış hâliyle **%95,4** tam uyum, ham hâliyle **%2,7** — kayıtların %95,4'ü tam +1'de yığılıyordu.

Sezon gösterimi (`2015–16`) aynı kuralla doğru sonuca varır (uzatılmış bitiş 2016, bir eksiği 2015). **Tek yıl** (`2014`) bir sezonun kendisidir, ayrılma yılı değil; çıkarma uygulanmaz.

#### Kimlik ve idempotenslik

Vikipedi'den gelen dönemin sentetik bir ifade kimliği olur: `wikipedia-<oyuncuQID>-<kulüpQID>-<başlangıçYılı>`. Wikidata'nınkiyle (`Q…-<UUID>`) çakışamaz, bu yüzden yükleme idempotent kalır — aynı veriyle ikinci koşu satır çoğaltmaz.

> Bu, kaldırılan elle düzeltme mekanizmasının sentetik kimliğine benziyor ama **aynı şey değil**: değer bir KAYNAKTAN türetiliyor, birinin elle yazdığı dosyadan değil. Fark mekanizmada değil, kaynağın kendini güncelleyip güncelleyemediğinde.

#### Ölçülen kazanç

Katman yazılmadan önce 400 oyunculuk örneklemlerle **+%9,5** tahmin edilmişti. Tam koşu tahmini aştı. Aşağıdaki sütunlar aynı önbellekten üretildi; ilk ikisi yalnızca `--skip-wikipedia` farkıyla:

| Ölçüt                 | Yalnız Wikidata | + `tr`/`en` (Aşama 1)   | + ana diller (Aşama 2)  | + 3. kademe (bugünkü)   |
| --------------------- | --------------- | ----------------------- | ----------------------- | ----------------------- |
| Dönem                 | 193.051         | 215.892 (**+%11,8**)    | 217.680 (**+%12,8**)    | **217.681**             |
| Eklenen dönem         | —               | 22.841                  | 24.629                  | 24.630                  |
| Zenginleşen dönem     | —               | 22.799                  | 28.338                  | **28.710**              |
| Düzeltilen değer      | —               | 21.703                  | 22.862                  | **23.279**              |
| **Seçilebilir kulüp** | 345 / 423       | 353 / 423               | **354 / 423**           | 354 / 423               |
| Makalesi olan oyuncu  | —               | 59.882 / 76.372 (%78,4) | 72.780 / 76.372 (%95,3) | 72.780 / 76.372 (%95,3) |

**+9 kulüp oynanabilir hâle geldi** — kazancın kullanıcıya doğrudan yansıyan kısmı bu. 586.992 kariyer satırı okundu; 44.287'si ikinci dilin kopyası, 359.812'si evrendeki bir kulübe ait değil (5. kuralın işlemesi).

Kazancın **ezici çoğunluğu Aşama 1'den** geliyor; ana dillerin net katkısı +1.788 dönem, +5.539 zenginleşen dönem ve +1 kulüp. Neden bu kadar az olduğu aşağıda ölçülüyor.

Son sütun dönem SAYISINI neredeyse hiç değiştirmiyor (+1) ama zenginleşen dönemi +372, düzeltilen değeri +417 artırıyor — üçüncü eşleşme kademesinin kazancı **sayıda değil, doğrulukta** (yukarıda).

#### Katman veri kümesini bozmamalı — dört ihlal ölçüldü ve kapatıldı

Kazancın yanında **maliyeti** de ölçüldü ve ilk hâli kabul edilemezdi. §8.2 denetimleri dört ayrı yoldan kötüleşti; dördü de aynı kök sebepten: zenginleştirme, alanları tek tek birleştirip kaydın BÜTÜNLÜĞÜNÜ gözetmiyordu.

| İhlal                                                           | Ölçülen | Yakalayan       | Düzeltme                                               |
| --------------------------------------------------------------- | ------- | --------------- | ------------------------------------------------------ |
| Vikipedi başlangıcı + Wikidata bitişi ⇒ ters aralık (2013–2012) | 15      | tam kuru koşu   | Yıl çifti birlikte değerlendirilir; tutarsızsa alınmaz |
| Vikipedi'nin makul olmayan yılı var olan kaydı öldürüyor        | 66      | tam kuru koşu   | Yıllar `isPlausibleSeasonYear`'dan geçer, `null` olur  |
| Genişleyen aralık aynı kulüpteki kardeş dönemin üstüne biniyor  | 418     | tam kuru koşu   | Yeni doğan çakışmada Wikidata'nın aralığı korunur      |
| Wikidata'nın maçı + Vikipedi'nin golü ⇒ gol > maç (BR-22)       | 9       | **`db:verify`** | Maç/gol çifti de birlikte değerlendirilir              |

**Dördüncüsünü yalnızca kabul kontrolü gördü.** Birim testleri de kuru koşu da temizdi: iki değer tek başına geçerli — Vikipedi yalnızca gol veriyor, Wikidata yalnızca maç — ama BİRLEŞİMLERİ geçersiz. `db:verify` yükleme sonrası 9 böyle dönem sayıp kabulü düşürdü; §8.2'nin "kuralın kodda doğru olması yetmez, üretilen VERİNİN ona uyduğu ölçülmelidir" ilkesi dördüncü kez işe yaradı.

Üçüncüsünün sebebi kaynakların farklı modellemesi: Wikidata bir kulüpteki kiralık ve kalıcı dönemi **ayrı** kayıtlarda tutuyor, bilgi kutusu ikisini çoğu zaman **tek satırda** birleştiriyor. Trippier'de Wikidata Burnley'i 2011 (kiralık) ve 2012–2014 (kalıcı) diye ayırmış, bilgi kutusunda tek satır 2011–2015 yazıyor.

Sonuç, ayıklama oranında ölçüldü: katman **hiçbir dönemi kaybettirmiyor**.

```
ayıklanan dönem:  4 (temel)  →  85  →  70  →  3
```

3'ün 4'ten küçük olması tesadüf değil: Vikipedi, Wikidata'da bozuk duran bir yılı da düzeltti.

**Kapanmayan tek uyarı örtüşen dönemler:** 1.263 → 1.988. Kalan 725'i aynı kulüpte değil, FARKLI kulüplerde örtüşüyor ve bir kısmı **gerçek** — sezon ortası transferde yıl hassasiyetli model iki kulübe de aynı sezonu yazmak zorunda. Uyarı seviyesinde bırakıldı.

#### Sınırlar — dürüstçe

- **Beş dil okunuyor, iki kademede.** `tr`/`en` her oyuncu için (%78,4 kapsam); `it`/`de`/`fr` yalnızca ikisinde de makalesi olmayanlar için. Toplam kapsam **%95,3**.
- **%4,7'nin makalesi hiçbir dilde yok** (3.592 oyuncu). Çoğu bir asır öncesinin oyuncusu; onlara hiçbir katman yardım edemez.
- **İtalyanca satırların %10,6'sı okunamıyor** ve bu kapatılmadı — gerekçesi ölçümle birlikte aşağıda.
- **Ayrıştırıcı bilgi kutusuna bağlı.** Makale metninde geçen kariyer tabloları okunmaz; bilgi kutusu yoksa (ya da `Infobox person` gibi kariyer alanı taşımayan bir kutu varsa) o oyuncudan kazanç yoktur. Ölçüldü: 471 makalenin 6'sı (%1,1) böyle.
- **Bilgi kutusu satırlarının çoğu evren dışı.** Alt lig ve kapsam dışı lig kulüpleri okunur ama eşleşmez; 586.992 satırın 359.812'si bu yüzden atıldı. Bu bir kayıp değil, 5. kuralın işlemesi.
- **ETL süresi artar.** Ölçüm: 1.903 oyunculuk denemede 76 istek, istek başına ~2,0 sn. Tam koşuya ölçeklenince `tr`/`en` katmanı **~1.760 istek ≈ 1 saat**, ana diller **~366 istek** daha ekliyor (66 SPARQL sorgusu, 24 takma ad, 276 metin grubu) — Wikidata'nın ~55 dakikasının üstüne toplam ~70 dakika. Genel toplam ~2 saat; `data-refresh` iş akışının sınırı bu yüzden 330 dakikaya çıkarıldı. İlk tasarım (bağlantı başına QID çözümü, 20'lik metin grupları) **~8.900 istek ≈ 4,9 saat** sürüyordu; üç ölçülmüş değişiklikle indirildi: makale adları SPARQL'den (250'lik grup), metin grupları 50'ye çıkarıldı, kulüp eşleştirmesi tersine çevrildi.
- **Makale metni bellekte tutulmaz.** İngilizce Vikipedi'de ~59.000 oyuncu makalesi, ortalama ~40 KB; hepsini biriktirmek ~2,4 GB ederdi (tek başına Harry Kane 289 KB). Metin grup grup ayrıştırılıp bırakılır.

#### Aşama 2 — ana dil ayrıştırıcıları (`it` / `de` / `fr`)

**Bu aşama önce ölçülüp "yazmaya değmez" diye reddedildi, sonra bilerek yazıldı.** Ret gerekçesi kayıtta kalsın: 1500 oyunculuk örneklemde deneme ayrıştırıcıları toplam 18 yeni dönem üretmişti; tam kümeye ölçeklenince ~900, yani **+%0,4**. Karar gözden geçirildi ve katman yine de yazıldı.

**Gerçek kazanç tahminin iki katı çıktı: +1.788 dönem (+%0,83) ve +1 seçilebilir kulüp.** Fark ayrıştırıcıdan geliyor — üretim ayrıştırıcısı deneme sürümlerinden ölçülebilir biçimde daha iyi okuyor (`fr`: 17/29 makale → **26/29**, 75 satır → **130**).

Yapı üç dilde de aynı: kariyer satırı **konumsal üçlü** (`yıl | kulüp | maç (gol)`), alan adı yok. Bu yüzden üçüne tek bir üçlü okuyucu yetiyor; diller yalnızca kabıyla ayrışıyor.

| Dil  | Dış kutu                     | Kariyer alanı                      | Kap                                       |
| ---- | ---------------------------- | ---------------------------------- | ----------------------------------------- |
| `it` | `{{Sportivo}}`               | `Squadre`                          | `{{Carriera sportivo}}`                   |
| `de` | `{{Infobox Fußballspieler}}` | `vereine_tabelle`                  | tekrarlı `{{Team-Station}}`               |
| `fr` | `{{Infobox Footballeur}}`    | `parcours senior` / `parcours pro` | `{{trois colonnes}}` / `{{parcours pro}}` |

**`es` bilerek dışarıda.** 25 makalenin yalnızca 2'sinde `equipos` alanı dolu, kariyer düzyazıda anlatılıyor ve bilgi kutusu **maç/gol hiç taşımıyor**.

##### İki kademeli sorgu — maliyet kararı

Ana diller **yalnızca `tr`/`en` makalesi olmayan oyuncular için** sorulur. Tam koşuda bu 76.372 oyuncunun **16.490'ı**; ana diller bunların **13.735'ine** ulaştı ve makale kapsamını %78,4'ten **%95,3'e** çıkardı.

Ayrımın sebebi ölçüldü: `tr`/`en` makalesi olan bir oyuncunun ana dil kutusundaki satırların **%88–96'sı Wikidata'da zaten var**. Beş dili herkese sormak isteğin çoğunu kopya veriye harcardı — üstelik her dil SPARQL'de ayrı bir `OPTIONAL` birleştirmesi demek.

##### Dil başına verim — asıl karar sayısı

Toplam kazanç bir dilin değerini göstermiyor. Okunan satırın **evrendeki bir kulübe düşme oranı** gösteriyor:

| Dil  | Okunan satır | Evrene düşen | Oran    |
| ---- | ------------ | ------------ | ------- |
| `tr` | 97.604       | 45.375       | %46     |
| `en` | 429.000      | 164.663      | %38     |
| `it` | 37.088       | 5.417        | **%15** |
| `de` | 13.859       | 5.591        | %40     |
| `fr` | 9.441        | 6.134        | **%65** |

Sıralama sezgiye aykırı ve sebebi ölçülebildi. **Fransızca en verimli dil** (%65) çünkü kulübü gerçek bir bağlantıyla yazıyor. **İtalyanca en verimsizi** (%15) çünkü kulübü düz metin olarak yazıyor ve o düz adlar kulübe değil **şehre** çözülüyor: `Torino`, `Napoli`, `Bologna`, `Catania`, `Novara`, `Pescara`, `Livorno` — hepsi it.wikipedia'da şehir maddesi (yalnızca `Milan` ve `Cremonese` kulübe gidiyor).

Bu bir hata değil, **doğru davranış**: indekste bulunmayan ad atlanır, tahmin edilmez. Yanlış kulübe bağlamaktansa satırı kaybetmek doğrudur (§2.7).

##### Kapatılmayan boşluk: İtalyanca kulüp şablonları

İtalyanca satırların **%10,6'sı** (699'un 74'ü) kulübü ne bağlantı ne düz metin olarak yazıyor, **şablonla** yazıyor: `{{Calcio Torino|G}}`. Şablon adından "Torino" çıkarmak mümkün ama **işe yaramaz** — yukarıdaki ölçüm gösterdi ki o ad şehre gidiyor. Doğru çözüm `prop=linkshere` ile şablon → kulüp indeksi kurmak; yeni bir API katmanı, dil başına 9 istek ve navbox şablonlarından gelen belirsizlik riski karşılığında toplam kazancın ~%0,04'ü. **Yapılmadı.**

##### Ayrıştırıcıyı birim testleri değil, korpus düzeltti

Üç fikstürle yazılan 26 birim testi temizdi. Ayrıştırıcı 471 makalelik gerçek korpusa koşturulunca **iki sessiz hata** çıktı — ikisi de "hiç okumama" biçiminde, yani hata vermeden veri kaybettiren türden (§8.2):

| Bulgu                                                                | Etkisi                                     | Düzeltme                 |
| -------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| `fr` yılları bağlantı içinde: `[[1984 en football\|1984]]-[[1990…]]` | aralık tek yıl okunuyor, dönem sonu kayıp  | bağlantı düzleştirme     |
| Kap adı alan adıyla aynı değil: `parcours senior = {{parcours pro}}` | 29 makalenin **9'u** sessizce boş          | kap listesi genişletildi |
| `{{nobr\|{{FRA-d}} [[FC Sochaux]]}}` sargısı                         | şablon atılırken bağlantı da gidiyor (22×) | ayraç sayarak sargı açma |

**Ölçüm sırasında bir tuzağa yeniden düşüldü.** Kalan boşluğu ararken kadro listeleri ADLA eşleştirildi ve Kvaratskhelia "eksik" göründü; oysa veri kümesinde **"Hviça Kvaratshelia"** olarak duruyordu. Ada güvenmenin bedeli bu projede beşinci kez ödendi (§5.3, §10.1). Ölçüm QID'e çevrildiğinde sonuç değişti.

**Katman veri kümesini yine bozmadı.** Ayıklanan dönem Aşama 1'deki gibi **3**; bloklayıcı hata yok. Yükleme sonrası `db:verify` de temiz — özellikle **"golü maçından fazla dönem: 0"**, yani dördüncü ihlalin (§4.3 tablosu) düzeltmesi ana dil verisiyle de tutuyor. İki uyarı büyüdü: örtüşen dönem 1.988 → 2.053, kuruluş yılından önceki dönem 9.158 → 10.162. İkincisi §10.2'de zaten "P571 sık sık selef kulübü gösteriyor" diye kayıtlı gürültülü bir denetim.

**Atıf — OLGULAR İÇİN.** Wikidata CC0, Vikipedi CC BY-SA. Çıkarılan şey olgudur ve olgular telife tabi değildir; yine de altbilgi her iki kaynağı da anar (§7.11).

> **Bu gerekçe GÖRSELLERİ KAPSAMAZ.** Bir arma ya da fotoğraf olgu değil, telife tabi bir eserdir. Yukarıdaki cümle uzun süre armaları da örttü sanıldı; ölçüm bunun yanlış olduğunu gösterdi (aşağıda). Görsellerin kendi sözleşmesi vardır ve §4.3.1'de yazılıdır.

#### 4.3.1 Arma kaynağı ve lisansı

Kulüp armaları **üç kaynaktan, bu sırayla** aranır ve **yalnızca özgür lisanslı** olanlar kabul edilir:

| Sıra | Kaynak                                 | Neden bu sırada                                                     |
| ---- | -------------------------------------- | ------------------------------------------------------------------- |
| 1    | Vikipedi bilgi kutusu (tr→en→it→de→fr) | En güncel armalar burada; ürün sahibinin gözlemi ölçümle doğrulandı |
| 2    | Wikidata `P154`                        | Kararlı ve makine okunur, ama seyrek ve daha eski                   |
| 3    | Commons kategorisi (`P373`)            | Yapısı gereği özgür; ilk ikisinin bulamadığını yakalıyor            |

**ÖLÇÜM: Vikipedi gerçekten daha güncel — ve tam da bu yüzden çoğu KULLANILAMAZ.** 60 armasız seçilebilir kulüpte ölçüldü (2026-08-08):

| Bulgu                                            |              Sayı |
| ------------------------------------------------ | ----------------: |
| Bilgi kutusunda arma bulunan kulüp               |           59 / 60 |
| Bulunan dosyalardan **adil kullanım** (non-free) | **67 / 80 = %84** |
| Commons'ta (özgür)                               |           10 / 80 |

Kulüplerin güncel resmî logoları Vikipedi'ye **adil kullanım** gerekçesiyle yükleniyor; Commons yalnızca özgür dosya barındırdığı için orada yoklar. Adil kullanım, Vikipedi'nin **kendi maddesinde** kullanma izniidir — üçüncü bir siteye yeniden kullanım hakkı vermez. Bu yüzden `NonFree` işaretli hiçbir dosya alınmaz (BR-33).

**ÖZGÜR DOSYALARLA KAPANAN BOŞLUK: %20.** Aynı 60 kulüpte beş dil ve Commons kategorisi tarandı:

| Kaynak             |             Kulüp |
| ------------------ | ----------------: |
| Vikipedi `tr`      |                 5 |
| Vikipedi `en`      |                 3 |
| Commons kategorisi |                 4 |
| **Toplam**         | **12 / 60 = %20** |

**KOŞUNUN GERÇEK SONUCU.** Örneklem 60 kulüptü; boru hattı 906 seçilebilir kulübün tamamına koşuldu ve tahmin tuttu:

|                          |        Önce |           Sonra |
| ------------------------ | ----------: | --------------: |
| Seçilebilir kulüpte arma | 270 (%29,8) | **396 (%43,7)** |

Kaynağa göre yeni armalar: Commons kategorisi 97, Vikipedi `tr` 35, Vikipedi `en` 19, `de`/`fr` 15. Commons kategorisi tahmin edilenden çok daha verimli çıktı (örneklemde 4/60 iken bütünde en büyük kaynak) — çünkü örneklemde yalnızca 36 kategori yoklanabilmişti.

Kalan ~510 kulüp doldurulamıyor. Bu bir uygulama eksikliği değil, **kaynak sınırıdır**; §10.2'ye borç olarak yazılmaz çünkü kapatılabilir bir borç değildir.

**ÇIKARIM DOĞRULANMADAN KABUL EDİLMEZ.** İlk koşu bunu pahalı biçimde gösterdi: bilgi kutusunun genel `image` alanı ve Commons kategorisi arma yerine başka görseller getirdi ve bunlar veritabanına YAZILDI —

```
1. FK Příbram     → Stadion Na Litavce2.jpg        (stadyum)
Bolton Wanderers  → Alf Farman.jpg                 (bir oyuncu portresi)
Athletic Bilbao   → Kit socks …bluelogo.png        (forma çorabı)
Cagliari          → IMG Logo del Trofeo Gigi Riva  (kupa logosu)
A.C. Savoia       → Coat of arms of the Duchy of Savoy
```

Eklenen akla yatkınlık süzgeci (`isPlausibleCrest`) iki koşulu birleştiriyor: adında armaya işaret eden bir sözcük geçmeli **ya da** kulüp adıyla ortak belirteç taşımalı, ve bir RET listesini (stadyum, forma, kupa, hava fotoğrafı…) geçmemeli. Toplam **28 yanlış arma** kaldırıldı, 37 aday baştan elendi.

**Süzgecin kendisi de bir hata verdi ve ölçülerek düzeltildi.** İlk hâlinde kısa sözcükler kelime içinde eşleşiyordu: `arma` → "Alf F**arma**n", `badge` → "Billy the B**adge**r" (Fulham'ın maskotu). İkisi de veritabanına yazılmıştı. Kısa sözcükler artık kelime sınırı istiyor, uzun ve ayırt edici olanlar (`logo`, `crest`, `stemma`…) istemiyor — çünkü dosya adları sıkışık yazılıyor (`BaltykaFCLogo2018.png`).

Süzgeç birkaç DOĞRU armayı da eliyor (kısaltmayla adlandırılmış dosyalar). Bu bilinçli bir takas: yanlış arma, boş armadan kötüdür (§2.7).

##### Denetim: "Commons'ta yok" gerçekten "telifli" mi? (`npm run db:crest-audit`)

BR-33 dosyaları **Commons'ta olup olmadığına** göre eliyor. Bu bir vekil ölçüttür: Commons'ta olmamanın üç sebebi olabilir ve yalnızca biri telif. Reddin haklı olup olmadığı ölçülmeden bilinemezdi, bu yüzden ayrı bir denetim betiği yazıldı — geçişle **aynı** adayları türetir (ortak `crest-fetch.ts`), yoksa ölçtüğü şey geçişin davranışı olmazdı.

**SONUÇ (2026-08-09, 579 armasız kulüp, 507 denetlenen dosya):**

| Karar                     |   Dosya |   Pay |
| ------------------------- | ------: | ----: |
| Adil kullanım (`NonFree`) | **484** | %95,5 |
| Belirsiz — yerel şablon   |      15 |  %3,0 |
| Künyesi özgür görünen     |       7 |  %1,4 |
| Yerel vikide de yok       |       1 |  %0,2 |

**Kullanılabilir çıkan: 2 dosya (507'de).** IFK Malmö ve Al-Shabab Riyad — düz `{{PD}}`, Commons kısıtı yok.

**KÜNYE, ÖZGÜRLÜĞÜ KANITLAMAYA YETMİYOR.** Bu denetimin en pahalı bulgusu. `extmetadata`, dünya çapında kamu malı olan bir dosya ile **yalnızca ABD'de** kamu malı olanı ayırt edemiyor; `{{PD-ineligible-USonly}}` ile düz `{{PD}}` aynı üç alanı üretiyor:

```
LicenseShortName: "PD"   UsageTerms: "Public domain"   Copyrighted: "False"
```

Ayrım yalnızca dosya sayfasının şablon metninde ("Do not copy this file to Wikimedia Commons", "non-free … in its home country"). Özgür görünen 7 dosya elle denetlendi: **5'i ABD'ye özgü çıktı** (SC Fives, SKA Habarovsk, Volos, Örgryte, Tirol Innsbruck), 2'si gerçekten özgürdü. Künyeye bakıp otomatik karar verilseydi 5 telifli dosya siteye girerdi. `classifyLocalFile` bu yüzden `özgür` değil **`özgür-görünüyor`** döner — bir izin değil, insanın bakması için ayrılmış kova.

**Belirsiz 15 dosya iki yerel şablondan geliyor; ikisi de reddedildi:**

| Şablon                           | Ne diyor                                                                                                                                                               | Karar |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `de` — Logo, Marken-/Namensrecht | "Erreicht nicht die nötige Schöpfungshöhe … jedoch markenrechtlicher Schutz" — **Alman hukukuna göre** telifsiz, kullanım "ausschließlich zu enzyklopädischen Zwecken" | ret   |
| `fr` — marque déposée            | "Copyright – utilisation restreinte"; yalnızca FR/CA/US için koşullu, başka bağlamda kullanılmaması **öneriliyor**                                                     | ret   |

Almanca şablonun kapsadığı kulüpler Portekiz, Çek, Norveç, İsveç ve Ukrayna kulüpleri: telifsizlik iddiası **kaynak ülke için değil**, Almanya için. Bu, `PD-USonly` ile yapı olarak aynı durum ve BR-33 ikisini de aynı gerekçeyle eliyor — tek bir ülkede özgür olmak yeterli değil.

**Yönlendirme şüphesi ölçüldü ve çürüdü.** `imageinfo` sorgusu `redirects=1` göndermiyordu; Commons'ta yeniden adlandırılan dosyaların eski adla aranınca "yok" görüneceği düşünüldü. Parametre eklendi: **kurtarılan dosya 0**. Gizli kusur olarak düzeltme yerinde kalıyor, ama kapsama katkısı yok.

**Sonuç: 507 dosyanın 505'i gerçekten kullanılamaz.** Ret oranı %99,6 doğruydu; BR-33'ün vekil ölçütü ölçümle doğrulandı.

---

## 5. Veri Modeli

### 5.1 Kavramsal Model

Kilit karar: oyuncunun bir kulüpteki dönemi ayrı bir varlıktır (**Spell**). "Oyuncu ↔ kulüp" ilişkisi çoktan-çoğa _değildir_; aynı oyuncu aynı kulüpte birden fazla kez oynayabilir (dönüşler, kiralık sonrası kalıcı transfer). Bu yüzden ilişki tablosu değil, kendi kimliği olan bir varlık kullanılır.

```
League 1───∞ Club 1───∞ Spell ∞───1 Player
```

### 5.2 Prisma Şeması (taslak)

```prisma
model League {
  id         String  @id @default(cuid())
  wikidataId String  @unique          // "Q9448"
  name       String
  country    String                   // ISO 3166-1 alpha-2: "GB"
  tier       Int     @default(1)
  clubs      Club[]
}

model Club {
  id          String  @id @default(cuid())
  wikidataId  String  @unique
  name        String                  // "Galatasaray S.K."
  shortName   String                  // "Galatasaray"
  searchKey   String                  // aksansız, küçük harf — arama için
  country     String
  foundedYear Int?
  crestUrl    String?
  playerCount Int     @default(0)      // BR-36: altyapı dışı TEKİL oyuncu
  isSelectable Boolean @default(false) // MVP seçim listesinde görünür mü
  leagueId    String?
  league      League? @relation(fields: [leagueId], references: [id])
  spells      Spell[]

  @@index([searchKey])
  @@index([isSelectable])
}

model Player {
  id           String  @id @default(cuid())
  wikidataId   String  @unique
  name         String
  searchKey    String
  birthDate    DateTime?
  nationality  String?                // ISO 3166-1 alpha-2
  position     String?                // §6.2'deki kapalı küme ya da null
  nationalCaps Int?                   // BR-14: tek takım için EN ÇOK maç
  heightCm     Int?
  weightKg     Int?
  spells       Spell[]

  @@index([searchKey])
}

model Spell {
  id           String  @id @default(cuid())
  playerId     String
  clubId       String
  startYear    Int?                   // null = bilinmiyor, uydurulmaz
  endYear      Int?                   // null = bilinmiyor VEYA hâlâ kulüpte
  isCurrent    Boolean @default(false)
  isLoan       Boolean @default(false)
  isYouth      Boolean @default(false) // altyapı dönemleri ayrıştırılır
  appearances  Int?
  goals        Int?

  // Wikidata ifade (statement) kimliği — doğal anahtar.
  wikidataStatementId String @unique

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  club   Club   @relation(fields: [clubId], references: [id], onDelete: Cascade)

  @@index([clubId, playerId])         // ortak oyuncu sorgusunun ana indeksi
  @@index([playerId])
}

/// Veri kümesinin künyesi — TEK satır (id sabit 1).
model DatasetMeta {
  id          Int      @id @default(1)
  generatedAt DateTime                 // ETL koşusunun bittiği an
}
```

> **`DatasetMeta` neden var (Faz 4).** Veri yılda iki kez tazelendiği için kullanıcı, gördüğü kadronun ne zamana ait olduğunu bilmelidir (§1.3). Bu tarihin **veriyle birlikte** taşınması gerekir: dağıtım zamanı yanlış cevaptır, çünkü kod tek başına yeniden dağıtıldığında veri eskimediği hâlde tarih tazelenirdi. Dosya değiştirme zamanı da yanlıştır — kopyalama onu sıfırlar. Doğru cevap ETL'in kendi bitiş anını yazmasıdır. Tek satırlık tablo, sabit `id = 1` ile zorlanır: ikinci bir satır eklenmesi birincil anahtar çakışması verir, yani "hangi künye geçerli" sorusu hiç doğmaz.

> **Faz 1'de değişen karar.** Taslakta `Spell` için bileşik bir tekillik kısıtı (`[playerId, clubId, startYear, isLoan]`) öngörülmüştü. Ölçüm sırasında Wikidata'nın her `P54` ifadesine kalıcı ve benzersiz bir kimlik verdiği görüldü (`Q161089-AD66DA21-…`). Bunu doğal anahtar yapmak daha iyi: bileşik anahtar tarihi bilinmeyen iki dönemi yanlışlıkla aynı sayardı, ifade kimliği ise hem çakışmaz hem her satırın kaynağını tek tek doğrulanabilir kılar. Ayrı bir `sourceRef` alanına da gerek kalmadı.

### 5.3 Wikidata Özellik Eşlemesi

Aşağıdaki kimliklerin hepsi **canlı sorguyla ölçülerek** belirlendi; tahmin yok. İkisi ilk taslaktaki varsayımı çürüttü ve düzeltildi.

| Alan             | Wikidata      | Not                                                       |
| ---------------- | ------------- | --------------------------------------------------------- |
| Kulüp sınıfı     | `Q476028`     | `P31/P279*` ile aranır — **kısıt zorunlu** (aşağıya bkz.) |
| Kulübün ligi     | `P118`        | Oyuncularda da kullanılıyor, tek başına yeterli değil     |
| Oyuncu–kulüp     | `P54`         | İfade (statement) olarak okunur, niteleyicileriyle        |
| Dönem başlangıcı | `pq:P580`     |                                                           |
| Dönem bitişi     | `pq:P582`     | Yoksa "hâlâ kulüpte" kabul edilir                         |
| Maç sayısı       | `pq:P1350`    |                                                           |
| Gol sayısı       | `pq:P1351`    | ⚠ İlk varsayım `P6509` idi — **yanlış**                   |
| Transfer türü    | `pq:P1642`    | Kiralık = `Q2914547` (ilk varsayım `Q1361518` — yanlış)   |
| Kuruluş yılı     | `P571`        |                                                           |
| Kulüp arması     | `P154`        | Yalnızca bazı kulüplerde var                              |
| Doğum tarihi     | `P569`        |                                                           |
| Mevki            | `P413`        |                                                           |
| Uyruk / ülke     | `P27` / `P17` | `P297` ile ISO alpha-2 koda çevrilir                      |
| Cinsiyet         | `P21`         | Yalnızca kapsam filtresi (BR-7); saklanmaz, gösterilmez   |

#### Kulüp sınıfı beyaz listesi

Kulüp sorgusunun tür kısıtı **tek sınıfla yapılamaz**. İki ucu da ölçtük:

- Kısıt **olmadan** 9091 sonuç döndü, 6066'sı **insandı** — `P118` oyuncularda da kullanılıyor.
- Kısıt **yalnızca `Q476028`** olduğunda FC Barcelona, Bundesliga'nın 18. ve Süper Lig'in 20. kulübü listeden düştü.

Altı ligdeki tüm insan-olmayan `P118` bağlarının tür dağılımı ölçülerek şu beyaz liste çıkarıldı:

| QID          | Sınıf                           |
| ------------ | ------------------------------- |
| `Q476028`    | association football club       |
| `Q103229495` | men's association football team |
| `Q15944511`  | association football team       |
| `Q20639856`  | professional sports team        |
| `Q847017`    | sports club                     |
| `Q13580678`  | multisports club                |

Sezon, maç, kadro listesi gibi takım olmayan türler (`Q26887310`, `Q109623729`, `Q51747567` …) bilinçli olarak dışarıdadır. Geniş görünen `sports club` / `professional sports team` sınıfları sorun yaratmaz: sorgu zaten belirli bir futbol ligine bağlı olmayı şart koştuğu için başka branşlar giremez.

#### Kulüp evreni: üç dal, tek karar mercii

Kulüp listesi **üç ayrı sorgudan** toplanır (`scripts/etl/sources/wikidata/queries.ts`):

| Dal       | Sorgu                    | Neden gerekli                                                                       |
| --------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `link`    | `clubsByLeagueLink`      | `P118` ile lige bağlı kulüpler — **tüm ifadeler**, kestirme değil (aşağıda)         |
| `seasons` | `clubsFromSeasons`       | `P118` eksik; Wolfsburg, St. Pauli, Heidenheim yalnızca `P3450`/`P1923` ile geliyor |
| `parents` | `clubsFromSeasonParents` | `P1923` bazen sezona özgü takım varlığı döndürür; gerçek kulüp `P831` ucunda        |

##### `wdt:` kestirmesi küme düşen kulübü kaybettiriyordu

Bu da **oyunda** görüldü: Yunus Akgün'ün kaydını incelerken kiralık gittiği **Adana Demirspor'un veri kümesinde hiç olmadığı** fark edildi. İki kusur aynı oyuncuda buluşuyordu — biri dönemi bloke ediyordu (üçüncü eşleşme kademesi, §4.3), diğeri kulübü tamamen yok sayıyordu.

Sebep `wdt:` kestirmesinde. Kestirme yalnızca _tercih edilen_ rütbedeki değeri döner; bir kulüp küme düşünce editörler yeni ligi tercih edilen yapıyor ve eski lig ifadesi _normal_ rütbeye iniyor:

```
Adana Demirspor (Q352251)
  P118 = Süper Lig   rütbe: normal     2021 → 2025
  P118 = 1. Lig      rütbe: TERCİH     2025 → …
```

`wdt:P118` yalnızca 1. Lig'i görüyor, kulüp evrenden sessizce çıkıyordu — 262 dönemiyle birlikte.

**İkinci dal bu boşluğu kapatamıyor ve sebebi ölçüldü.** Süper Lig'in 69 sezon kaydının yalnızca **3'ünde** `P1923` katılımcı listesi var:

| Lig            | Sezon kaydı | `P1923` taşıyan | Katılımcı |
| -------------- | ----------- | --------------- | --------- |
| Premier League | 36          | 33              | 51        |
| La Liga        | 98          | 95              | 61        |
| Serie A        | 125         | 97              | 99        |
| Bundesliga     | 63          | 63              | 93        |
| Ligue 1        | 95          | 88              | 75        |
| **Süper Lig**  | 69          | **3**           | 26        |

Yani sezon dalı Türkiye için fiilen çalışmıyor; `P118` tek gerçek kaynak. Bu, ölçülmemiş bir varsayımın daha çürümesi: "üç dal birbirini tamamlar" doğru, ama **her ligde aynı oranda değil**.

Sorgu artık `p:P118/ps:P118` ile tüm ifadeleri okuyor. _Deprecated_ rütbe dışarıda: o rütbe "yanlış olduğu bilinen" demektir ve okumak veri kümesine bilerek hata almak olurdu (altı ligde 5 böyle ifade var).

> **Ölçülen kazanç: 12 aday, 10'u gerçek kulüp ve hepsi Süper Lig.** Premier League, La Liga, Serie A ve Ligue 1'de **hiç yeni kulüp yok** — o liglerde sezon dalı zaten yakalıyordu.
>
> Kalan 2 aday Hamburger SV ve FC Augsburg'un "birinci erkek takımı" varlıkları. İkisinin de **0 dönemi** var, yani yüklemedeki boş kulüp temizliği onları zaten atıyor — kulüp ikizleşmesi oluşmuyor. Bu, "aday üret, kararı dönem sayısı versin" tasarımının dördüncü kez işe yaraması.
>
> | Kulüp           | Wikidata `P54` | Yüklenen | Kulüp        | Wikidata `P54` | Yüklenen |
> | --------------- | -------------- | -------- | ------------ | -------------- | -------- |
> | Adana Demirspor | 262            | **436**  | Hatayspor    | 106            | **182**  |
> | Altay           | 244            | **335**  | Pendikspor   | 53             | **133**  |
> | Eskişehirspor   | 235            | **316**  | Ümraniyespor | 42             | **125**  |
> | Giresunspor     | 195            | **352**  | Erzurumspor  | 40             | **131**  |
> | İstanbulspor    | 194            | **314**  | Bodrum FK    | 3              | **65**   |
>
> Sağ sütunun sol sütundan büyük olması Vikipedi katmanının işidir: yeni kulüplerin dönemleri §4.3 katmanıyla zenginleşiyor. **Onunun da hepsi 50 dönem eşiğini geçti**, yani onu da oynanabilir — Wikidata'da 3 dönemle görünen Bodrum FK dâhil.

**Toplam etki:** kulüp 395 → **405**, oyuncu 76.372 → **76.757**, dönem 217.679 → **220.204**, seçilebilir kulüp 354 → **364**. Süper Lig'in veri kümesindeki kulüp sayısı 34 → **44**. `db:verify` temiz kaldı. (Kulüp sayısı sonradan ikiz birleştirmesiyle 383'e indi — aşağıda.)

**`P831`'in yönü Wikidata'da tutarsızdır** ve hangi ucun gerçek kulüp olduğu türden okunamaz. Ölçüm:

| Tohum                         | `P831` hedefi              | Oyuncu (tohum → hedef) |
| ----------------------------- | -------------------------- | ---------------------- |
| `Q97905916` FC Augsburg 25-26 | `Q15755` FC Augsburg       | 0 → **326**            |
| `Q7156` FC Barcelona          | `Q3091261` FC Barcelona    | **1399** → 22          |
| `Q43710` Antalyaspor          | `Q12808521` Antalyaspor K. | **277** → 7            |

İlk satır çözümlemeyi gerektirir, diğer ikisi çözümlemeden zarar görür. Bu yüzden `P831` bir **çözümleme** (tohumun yerine ebeveyni koymak) olarak değil, **ek aday** olarak kullanılır: üç dal da yalnızca aday üretir.

Kararı tahmin değil ölçüm verir: her aday için dönemler çekilir, `MIN_SPELLS_FOR_SELECTABLE` (50) eşiğinin altındakiler seçilemez işaretlenir, hiç dönemi olmayanlar yükleme sonunda silinir. Böylece "gerçek kulüp hangisi" sorusunu, cevabı zaten ölçtüğümüz büyüklük — kulübe bağlı `P54` ifadesi sayısı — yanıtlar.

Bu tasarım üç kez sırayla kırılan üç ayrı kuralın yerine geçti: önce çözümleme hiç yoktu (Augsburg 0 dönemle girdi), sonra her kulübe uygulandı (Barcelona ve Antalyaspor kabuk varlığa taşındı), sonra yalnızca sezon dalına uygulandı (Antalyaspor yine bozuldu, çünkü `P1923` katılımcısı her zaman sezon varlığı değil). Ortak hata, veriden okunabilecek bir şeyi kuralla tahmin etmekti.

#### Kulüp ikizleri: aynı kulüp iki varlığa bölünmüş

Aday üretme tasarımı bir kusuru **görünür bırakıyordu**: adaylardan ikisi de eşiği geçerse kullanıcı seçim listesinde aynı kulübü iki kez görüyor. Süper Lig listesinde `Fenerbahçe` (749 dönem) ile `Fenerbahçe SK` (97) yan yana duruyordu — hangisi seçilirse seçilsin kariyerin bir kısmı eksik kalıyordu.

Sebep Wikidata'nın modellemesi: şemsiye **spor kulübü** (çok şubeli) ile onun **futbol takımı** ayrı varlıklar ve oyuncuların `P54` ifadelerini editörler rastgele birine bağlıyor.

**AYNI BAĞ İKİ FARKLI ŞEYİ GÖSTERİYOR ve karışması pahalı.** `P361` (parçası) ve `P831` (ana kulüp) hem ikizleri hem SELEF/HALEF kulüpleri bağlar: `RC Roubaix`, 1945'te `CO Roubaix-Tourcoing`'i oluşturan birleşmeye girmiştir ve o bağ da `P361`'dir. İkisi ayrı kulüptür; birleştirmek iki gerçek kulübün geçmişini karıştırırdı.

**Ayrımı eşik değil SINIF verir** — ama sorulacak soru "iki taraf da futbol kulübü mü" DEĞİLDİR. Doğru soru şudur: **bir tarafta ŞEMSİYE sınıfı (`Q847017` spor kulübü, `Q13580678` çok şubeli kulüp) var mı, ötekinde yok mu?** Bağ ancak bu asimetri varsa şemsiye/şube ayrımıdır; iki taraf da düz futbol kulübüyse bağ bir birleşme kaydıdır.

> **İlk kural "iki taraf da `Q476028` ise ele" diyordu ve ÖLÇÜLEREK yanlış bulundu.** Wikidata çok şubeli kulüpleri düzenli olarak İKİ sınıfla birden etiketliyor — şemsiye kulüp aynı zamanda futbol kulübüdür:
>
> | Öğe                            | `P31`                     |
> | ------------------------------ | ------------------------- |
> | `Q329607` IFK Norrköping       | `Q847017` + **`Q476028`** |
> | `Q297906` Örgryte IS           | `Q847017` + **`Q476028`** |
> | `Q33748` Hannover 96 (şemsiye) | `Q847017` + **`Q476028`** |
>
> Şube de doğal olarak `Q476028` taşıyor. Yani "ikisi de futbol kulübü" koşulu gerçek ikizlerde de sağlanıyordu ve kural onları **kendi elinde tuttuğu hâlde** eliyordu. Kusur Wikidata'da değil, sorgudaydı.

> **Yeni kural bütün evrende ölçüldü (992 kulüp).** Mevcut kural 71 çift buluyor, yeni kural 67. Fark aldatıcı — içeriğe bakılınca:
>
> | Değişim                 | Sayı | Etkisi                                                                                                       |
> | ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
> | Yeni kuralın kazandığı  | 3    | **Örgryte IS** ve **IFK Norrköping** ikizleri kapanıyor; üçüncüsü evren dışı bir ebeveyne bağlı              |
> | Yeni kuralın kaybettiği | 7    | **hepsi evren dışı ebeveyne bağlı** — birleştirme iki ucu da tanımayan çifti zaten atıyor (`merge-clubs.ts`) |
>
> Yani veri kümesinde net etki: **iki gerçek ikiz kapanıyor, hiçbir şey kaybedilmiyor.**

> **§5.3'ün belgelediği dört çift gerileme testi olarak yeniden koşuldu ve dördü de doğru davranıyor:**
>
> | Çift                              | Şemsiye sınıfı asimetrisi             | Ortak oyuncu | Karar          |
> | --------------------------------- | ------------------------------------- | ------------ | -------------- |
> | Fenerbahçe / Fenerbahçe SK        | var (`Q19648` = `Q13580678`)          | 81/97 (%84)  | **birleştir**  |
> | Hannover 96 / Hannover 96         | var (`Q33748` = `Q847017`+`Q476028`)  | 6/7 (%86)    | **birleştir**  |
> | Bursaspor / Bursaspor Kulübü      | var (`Q6096484` = `Q847017`)          | 23/38 (%61)  | **birleştir**  |
> | CO Roubaix-Tourcoing / RC Roubaix | **yok** (ikisi de yalnızca `Q476028`) | 4/53 (%8)    | **ayrı bırak** |
>
> Ortak oyuncu oranı kuralın KENDİSİ DEĞİL, doğrulamasıdır. Eşik uydurmak dört veri noktasına eğri uydurmak olurdu; sınıf kısıtı ise Wikidata'nın kendi anlamını okuyor.

> **Birleşme YÖNÜ değişmedi ve bunun görünür bir bedeli var.** Yön hâlâ dönem sayısıyla belirlenir (aşağıda), şemsiye/şube ilişkisiyle değil. Sonuç: Örgryte ve IFK Norrköping'de şube kaydı daha çok döneme sahip olduğu için asıl kayıt o oluyor ve kulüp listede **"Örgryte IS Fotboll"** / **"IFK Norrköping FK"** diye görünecek. İkisi de yanlış ad değil; yönü ilişkiye bağlamak ise Fenerbahçe'yi "Fenerbahçe SK"ye çevirirdi. Ölçülmemiş bir iyileştirme için ölçülmüş bir davranış bozulmuyor (§10.2).

Hangi tarafın asıl olduğunu yine **dönem sayısı** söyler — bu bölümün zaten kurduğu karar mercii. Eşitlikte QID sırası belirler; sıranın koşudan koşuya sabit kalması şart, aksi hâlde aynı veri farklı kulüp kimlikleri üretir.

**Taşıma dönem kaybettirmez ama kopya da üretmez.** Gölgenin dönemleri asıl kulübe geçerken §4.3'ün kurduğu ilke uygulanır: örtüşme belirsizliğin ta kendisidir. Ölçüldü — ham Wikidata verisinde taşınacak 129 dönemin 101'i ayrık (taşındı), 7'si birebir kopya, 21'i örtüşen (ikisi de atıldı). İkinci kopya üretilseydi §8.2'nin "örtüşen kalıcı dönem" uyarısı büyürdü.

Birleştirme oyuncu geçişinden **önce** yapılır: gölgede dönemi olan oyuncular sonraki adımların dışında kalmasın diye.

##### Kapatılmayan boşluk: bağsız ikizler

Kural **ilişki taşıyan** çiftleri kapatıyor. Wikidata'da bazı ikizler hiçbir ilişki taşımıyor: `Gençlerbirliği SK` (509 dönem) ile `Gençlerbirliği (futbol takımı)` (453) arasında ne `P361` ne `P831` ne de `P527` var. İki taraf da `Q476028`, yani sınıf kısıtı da onları ayrı sayar. Sorgu bu çifti **hiç göremiyor**.

Boşluğu kapatmak için dört ayırt edici sırayla denendi; **dördü de ölçümle elendi**:

| Denenen ayırt edici          | Neden elendi                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ortak oyuncu oranı           | İkizi akrabadan ayırmıyor — aşağıdaki tablo.                                                                                                       |
| Dönem zamanlarının örtüşmesi | İkizde %99; ama Ancona %100, Troyes %100, Vicenza %96. Ayırt etmiyor.                                                                              |
| Kuruluş yılı (`P571`)        | Gölge kayıtta `P571` hiç yok — karşılaştırılacak değer bulunmuyor.                                                                                 |
| Vikipedi madde sayısı        | Gölgelerin **gerçek maddeleri var**: `Q20473364` → tr.wikipedia "Gençlerbirliği (futbol takımı)", `Q108001798` → sv.wikipedia "IFK Norrköping FK". |

Son satır bir varsayım olarak kurulup **uygulandıktan sonra** çürüdü: kural yazıldı, birim testleri geçti, gerçek veri üzerinde 15 ad çakışmasının **hiçbirinde** tetiklenmedi. Ölçüm varsayımı yalanlayınca çalışan kod geri alındı — eşiği 1'e çekmek kuralı veriden değil sonuçtan türetmek olurdu.

Ortak oyuncu oranı ikizleri yakalardı. **Birleştirme için kullanılmadı** ve gerekçesi ölçüldü: 906 seçilebilir kulübün 409.965 çiftinden en az bir oyuncu paylaşan 118.247'si tarandığında, üst banttaki çiftlerin bir kısmının ikiz DEĞİL akraba olduğu görüldü.

| Oran  | Çift                                          | Gerçekte ne                             |
| ----- | --------------------------------------------- | --------------------------------------- |
| %94,0 | Ancona / A.C. Ancona                          | yeniden kurulmuş kulüp                  |
| %92,5 | Gençlerbirliği / Gençlerbirliği (futbol tak.) | **gerçek ikiz**                         |
| %89,1 | Kharkiv / FK Metalist 1925 Harkiv             | ayrı kulüpler, kadro devri              |
| %80,0 | **CD Condal** / Barcelona                     | Barcelona'nın 1950'lerdeki yedek takımı |
| %79,0 | Örgryte IS / Örgryte IS Fotboll               | **gerçek ikiz**                         |
| %79,0 | IFK Norrköping / IFK Norrköping FK            | **gerçek ikiz**                         |
| %76,8 | Karpaty Lviv / FK Karpaty Lviv                | **gerçek ikiz**                         |
| %69,4 | Toulouse FC (1937) / Toulouse FC (1970)       | eski/yeni kulüp                         |
| %64,8 | LR Vicenza / Vicenza                          | ad değişikliği                          |
| %59,4 | Troyes AC / AS Troyes                         | selef/halef                             |

Gerçek ikiz (%92,5) ile yeniden kurulmuş kulüp (%94,0) **aynı bantta**; %80'lik bir eşik Barcelona'yı yedek takımıyla birleştirirdi. Yedek takım, selef kulüp ve kadro devralan kulüp doğaları gereği oyuncu paylaşır — oran bu dördünü ayırt edemez.

Bu yüzden birleştiren bir kural **yazılmadı**. Doğru düzeltme yeri **kaynağın kendisi**: Wikidata'da eksik ilişkinin eklenmesi. Uydurulmuş bir eşikle burada kapatmak, iki gerçek kulübü karıştırma riskini veri kümesine yaymak olurdu.

##### Oran BİRLEŞTİRMEZ, ama SORUYU değerlendirir (BR-36)

Yukarıdaki tablo bir yenilgi gibi okunuyor; değil. Oran **yanlış soruya** cevap veriyordu. "Bu iki kayıt aynı kulüp mü?" sorusunda çöküyor. Ama ortak oyuncu modunun sorduğu soru bu değil:

> Bu iki kulübün ortak oyuncularını bulmak **bir şey öğretiyor mu?**

Bu soruda oran çökmüyor, **tanım oluyor**. Condal ile Barcelona hukuken ayrı kulüptür — ve "hem Condal'da hem Barcelona'da oynayan" listesi yine de değersizdir, çünkü Condal'ın 65 oyuncusunun 52'si zaten Barcelona'da oynamış. Kimliği bilmeye gerek yok; cevabın **küçük kulübün kadrosunun tamamına yakınını kapladığını** ölçmek yetiyor.

**Eşik uydurulmadı, ölçülen boşluğa kondu.** 118.247 kesişen çiftin oran dağılımında %69,4 ile %76,8 arasında **hiçbir çift yok**. Eşik o boş bandın içine konur; 0,70 ile 0,75 arası her değer aynı yedi çifti verir.

| Eşik | Tetiklenen çift |
| ---- | --------------- |
| 0,60 | 10              |
| 0,70 | **7**           |
| 0,75 | **7**           |
| 0,80 | 4               |
| 0,90 | 2               |

**Asgari kadro tabanı ölçüldü ve EKLENMEDİ.** İlk taslakta "küçük tarafta en az N oyuncu" koşulu vardı. Ölçüm: 0,75 eşiğinde taban 0 da, 25 de, 50 de **aynı yedi çifti** veriyor. Etkisi ölçülüp sıfır çıkan bir ayar, ileride birinin çevireceği boş bir düğmedir — kural tek eşikli kaldı.

**Risk profili birleştirmenin tam tersidir ve karar bunun üzerine kuruludur.** Yanlış birleştirme veriye yayılır ve geri alınamaz; yanlış uyarı bir cümledir. Bu yüzden aynı sinyal, birleştirmede reddedilirken uyarıda kabul edilir. Uyarı metni de bu ayrımı korur: "aynı kulüp" **denmez** (Condal ve Kharkiv çiftlerinde yanlış olurdu), yalnızca ölçülen şey söylenir.

Kural **ızgara modlarını kapsamaz.** Orada soru "bir isim söyle"dir ve zorluğu BR-9'un cevap sayısı bandı yönetir: 52 cevaplı bir hücre kolaydır ama bozuk değildir. Kapsam, kullanıcının iki kulübü serbest seçtiği tek yerdir — ortak oyuncu modu.

##### Ayrı kalan kulüpler seçicide AYIRT EDİLEBİLMELİ

Yukarıdaki tablonun ikinci bir sonucu var ve ilkinden bağımsız: birleştirilmesi **doğru olmayan** çiftler kullanıcının önüne yan yana çıkıyor. `Toulouse FC` ile `Toulouse FC` iki ayrı kulüp — 1937'de kurulan 1967'de dağıldı, bugünkü kulüp 1970'te kuruldu — ama kulüp seçici ikisini de aynı satırla basıyor.

Seçicinin bastığı alanlar `shortName`, ülke ve armadır (`club-picker.tsx`). Arma ayırt edici **sayılamaz**: Wikidata'da sık sık boştur ve Toulouse çiftinde ikisi de boş. Geriye kalan iki alan çakıştığında kullanıcının seçecek hiçbir dayanağı kalmıyor.

**Ölçüm — 383 kulübün tamamı tarandı:**

| Kademe | Ayırt edici                      | Çözülen küme  | Kalan |
| ------ | -------------------------------- | ------------- | ----- |
| 0      | `shortName` + ülke (seçicide bu) | —             | **3** |
| 1      | tam ad (`name`)                  | Troyes, Nancy | **1** |
| 2      | kuruluş yılı (`P571`)            | Toulouse      | **0** |

| Küme          | Kulüpler                                          | Ne oldu              |
| ------------- | ------------------------------------------------- | -------------------- |
| `Troyes` / FR | `Troyes AC` (Q501693) · `AS Troyes` (Q2868069)    | tam ad ayırdı        |
| `Nancy` / FR  | `AS Nancy` (Q19523) · `FC Nancy` (Q1387406)       | tam ad ayırdı        |
| `Toulouse`/FR | `Toulouse FC` (Q2422417) · `Toulouse FC` (Q19518) | kuruluş yılı gerekti |

**Dönem yıl aralığı denendi ve ELENDİ.** İlk sezgi "kulübün dönemleri hangi yıllara yayılıyor" idi; ölçüm çürüttü: Q19518 (kuruluş 1970) veri kümesinde **1937**'den başlayan dönemler taşıyor — kaynaklar eski kulübün kayıtlarını bugünküne yazmış. Ayırt edici olarak kuruluş yılı kaldı.

**`P571` gürültülüdür (§10.2) ve bu yüzden yalnızca SON kademede kullanılıyor.** Gürültünün etkisi çakışan kümelerle sınırlı: 383 kulübün 380'i kısa adını olduğu gibi koruyor, yıl yalnızca başka hiçbir alanın ayırmadığı yerde ekleniyor.

**Karşılaştırma birebirdir.** Sorulan soru "bu iki satır aynı anlama mı geliyor" değil, "kullanıcı ekranda ikisini ayırt edebiliyor mu". İlk sürüm harf duyarsız karşılaştırıyordu ve birim testi bir kusur buldu: `toLocaleLowerCase("tr")` Türkçede `I` → `ı` çevirdiği için "REAL MADRID" ile "Real Madrid" zaten eşleşmiyordu. Yerel ayara bağlı harf çevirimi çok dilli veri kümesinde sessizce yanlış cevap veriyor.

Kural `club-labels.ts` içinde saf bir geçiş olarak duruyor ve ikiz birleştirmesinden **sonra** çalışır — birleşen kulüpler zaten tek satıra indiği için önce çalıştırılsaydı gereksiz yere ad uzatırdı. Üç kademe de tükenirse ad **değiştirilmez**; çakışma `db:verify`'da rapor edilir, çünkü o noktada elde kalan şey bir gösterim sorunu değil, kaynakta birleştirilmesi gereken gerçek bir ikizdir.

### 5.4 İş Kuralları

Bunlar `domain/services/` içinde saf fonksiyon olarak yaşar ve birim testi ile korunur:

- **BR-1 — Ortak oyuncu tanımı:** Bir oyuncu, A kulübünde en az bir `Spell` ve B kulübünde en az bir `Spell` kaydına sahipse ortaktır. Dönemlerin zaman olarak örtüşmesi _gerekmez_ (zaten aynı anda iki kulüpte olamaz).
- **BR-2 — Altyapı dönemi:** `isYouth = true` olan dönemler varsayılan olarak **sayılmaz**. Kullanıcı "altyapıyı da dahil et" seçeneğiyle açabilir.

  **Ad kalıbından `II` ve tek harflik `B` ekleri ÇIKARILDI (Faz 4.11).** Tespit kulübün adına bakıyor ve bu ekler yedek takım geleneğini (`Ajax II`, `Barcelona B`) hedefliyordu. Ölçüm — 992 kulübün tamamı tarandı — kalıba takılan **tek** kulübü verdi: **Willem II**, bir Eredivisie kulübü. Sonuç ağırdı: 510 döneminin hepsi altyapı sayıldığı için kulüp seçilebilir olduğu hâlde **her modda sıfır sonuç** veriyordu. Aynı tarama gerçek yedek takım sayısını da verdi: **sıfır** — kulüp evreni lig üyeliğinden geliyor ve yedek takımlar bu liglerde yok. Yani iki dal hiçbir doğru eşleşme üretmiyor, bir gerçek kulübü siliyordu. Kusur BR-36'nın `db:verify` denetimi (`playerCount = 0`) tarafından bulundu. Yedek takımlar ileride evrene girerse ad kalıbı yetmez: doğru ayrım "eki atınca kalan ad başka bir kulübe mi ait" sorusudur (§10.2).

- **BR-3 — Kiralık:** Kiralık dönemler varsayılan olarak **sayılır**, fakat listede açıkça "kiralık" rozetiyle işaretlenir.
- **BR-4 — Aynı kulüp seçimi:** A ile B aynı kulüp ise istek reddedilir (`400`).
- **BR-5 — Sıralama:** Sonuçlar, iki kulüpteki toplam maç sayısına göre azalan; maç bilgisi yoksa en son dönem yılına göre azalan sıralanır.
- **BR-6 — Tarih normalizasyonu:** Wikidata'nın gün hassasiyetli tarihleri sezon yılına indirgenir (Temmuz–Aralık → o yıl; Ocak–Haziran → bir önceki yıl sezonuna ait).

  **Hassasiyet ayrımı zorunludur.** Wikidata tarihlerin çoğunu yalnızca YIL hassasiyetinde tutar (`+2025-00-00`, `precision: 9`) ve WDQS bunları `2025-01-01` diye normalleştirir. Bu değeri gerçek bir Ocak tarihi sanmak, yukarıdaki kural gereği kaydı bir önceki sezona yazar. Ölçüm (Arsenal, Galatasaray, Real Madrid, Liverpool — 3.454 başlangıç tarihi):

  | Hassasiyet | Kayıt |      Oran |
  | ---------- | ----: | --------: |
  | yıl (9)    | 3.235 | **%93,7** |
  | ay (10)    |    78 |      %2,3 |
  | gün (11)   |   140 |      %4,1 |

  Yani başlangıç yıllarının neredeyse tamamı bir sezon erkendi. Belirti, kaydın kendi içinde çelişmesiydi: Šeško aynı anda Leipzig'de (2022–2025) ve Manchester United'da (2024–) görünüyordu; veritabanında 5.020 çakışan kalıcı dönem çifti vardı. Çözüm, `pqv:` değer düğümünden `wikibase:timePrecision` okumaktır. Yıl hassasiyetinde iki uç ZITTIR ve bu bir varsayım değil, Avrupa futbol takviminin sonucudur:

  - başlangıç `2025` → 2025/26 sezonu → **2025** (yaz transferi)
  - bitiş `2025` → 2024/25 sezonunun sonu → **2024**

  Yıldan kaba hassasiyet (on yıl, yüzyıl) bir sezona indirgenemez ve `null` olur (§2.7).

  **Tek takvim yılına sığan dönem istisnası.** `2024 → 2024` kaydında iki kural ters düşer (başlangıç 2024, bitiş 2023). Bitiş kuralının dayanağı "ayrılış, Y−1 sezonunun sonundadır" varsayımıdır; katılış aynı yıl olduğunda bu geçersizdir. Bu durumda bitiş başlangıca hizalanır. İhmal edilemez: veri kümesinde başlangıcı bitişine eşit **19.478** dönem var, yani düzeltilmezse ayıklama oranı §8.2'deki %1 eşiğini katlayarak aşar ve ETL hiç tamamlanamaz.

- **BR-7 — Kapsam: erkek ligleri.** Veri kümesi hedeflenen altı erkek ligiyle sınırlıdır. Wikidata kadın takımı dönemlerini çoğu zaman **aynı kulüp varlığına** bağladığı için ayrım kulüp düzeyinde yapılamıyor; `P21` (cinsiyet) alanı yalnızca bu kapsamı uygulamak üzere okunur, veritabanına yazılmaz ve arayüzde gösterilmez. `P21` kaydı olmayan oyuncular **kapsamda kalır** — eksik meta veri dışlama gerekçesi değildir. Kadın futbolu ileride kendi lig kümesiyle ayrı bir kapsam olarak eklenebilir (§10.2).
- **BR-33 — Arma yalnızca ÖZGÜR lisanslı dosyadan gelir.** `NonFree` işaretli (adil kullanım) hiçbir dosya alınmaz; alınırsa site telif ihlaline girer. Ölçüldü (§4.3.1): Vikipedi bilgi kutularındaki armaların %84'ü bu sınıfta ve reddedilir. Kural bir tercih değil sınırdır — "arma boş kalsın" sonucu, kullanılamayacak bir dosyayı göstermekten iyidir (§2.7 ile aynı yön).
- **BR-34 — Atıf gerektiren arma, atıf verisi OLMADAN gösterilmez.** CC BY / CC BY-SA dosyalarında yazar, lisans adı ve dosya sayfası birlikte saklanır; üçünden biri eksikse arma `null` sayılır. Eksik atıfla göstermek, lisansın koşulunu çiğnemek demektir; `db:verify` bunu ölçer (§8.2).
- **BR-35 — Her kulüp bir işaret taşır; hiçbir yuva boş kalmaz.** Kulüp adının yanındaki işaret sabit ölçüdedir ve iki içerikten birini taşır: lisanslı arma varsa arma, yoksa kulüp adından türetilen baş harfler. "Bazı kulüpte arma, bazısında boşluk" durumu yasaktır — armanın kapsamı %43,7 olduğu için bu, listelerin yarısının delik görünmesi demekti. Baş harfler bir VERİ DEĞİL, addan türetilir; ek bir kaynak, ETL adımı veya lisans yüzeyi getirmez (§7.13).
- **BR-36 — Dejenere kulüp çifti işaretlenir, birleştirilmez.** Ortak oyuncu sayısı, iki kulübün küçüğünün altyapı dışı tekil oyuncu sayısının **%75'ine** ulaşırsa sonuç _dejenere_ sayılır: liste bir keşif değil, küçük kulübün kadro dökümüdür. Sonuç **değişmez** — hiçbir kayıt gizlenmez, silinmez, birleştirilmez — yalnızca ölçülen olgu kullanıcıya bildirilir. Bildirimde kimlik iddiası **yasaktır** ("aynı kulüp" denmez): tetiklenen yedi çiftin ikisi gerçekten ayrı kulüptür (§5.3). Eşik ölçülen boş banda konmuştur (%69,4 ile %76,8 arasında hiçbir çift yok) ve kural yalnızca ortak oyuncu modunu kapsar; ızgarada zorluğu BR-9 yönetir.
- **BR-37 — Kulüp seçimi ada YAZMAKLA sınırlı değildir; lige göre gözatılabilir.** Seçici iki kademelidir: arama kutusu boşken 24 ligin listesi (kulüp sayılarıyla), bir lig seçilince o ligin kulüpleri. Yazmak kademe 1'de bütün kulüplarda, kademe 2'de ligin içinde arar — yani ad araması hiçbir kademede kaybolmaz. Süzgeç değeri lig **QID'idir**, veritabanı kimliği değil: kimlikler her ETL koşusunda değişir, QID değişmez (§9.1 ile aynı gerekçe). Liste `MAX_CLUB_RESULTS` sınırında kesilirse kesildiği AÇIKÇA yazılır ("83 kulüpten 50'si gösteriliyor"); sessiz kesme, kullanıcıya eksik listeyi tam liste diye gösterir ve aradığı kulübü "veri kümesinde yok" sanmasına yol açar (§7.14).
- **BR-8 — Kanıt düzeyi.** Bir `Spell`, `startYear`, `endYear`, `appearances` ve `goals` alanlarının **dördü de** boşsa **kanıtsızdır**; en az biri doluysa kanıtlıdır. Kanıtsız dönemler BR-1 kapsamında **sayılır** (elenmez), fakat API yanıtında ve arayüzde açıkça işaretlenir. Gerekçe ve ölçüm §1.4'tedir; özeti: eleme, uydurma kayıtlarla birlikte doğru kayıtları da siliyor ve Wikidata ikisini ayıracak bir sinyal taşımıyor. BR-5'in sıralaması bu dönemleri kendiliğinden en sona koyar (ne maç sayısı ne yıl bilgisi vardır), dolayısıyla ayrı bir sıralama kuralı gerekmez.

---

## 6. API Sözleşmesi

Tüm uçlar `Content-Type: application/json` döner. Hata gövdesi tek biçimlidir.

### 6.1 `GET /api/clubs`

Kulüp arama / otomatik tamamlama.

| Parametre | Tip    | Zorunlu | Kural                                            |
| --------- | ------ | ------- | ------------------------------------------------ |
| `q`       | string | hayır   | 1–50 karakter, kırpılır                          |
| `limit`   | int    | hayır   | 1–50, varsayılan 20                              |
| `league`  | string | hayır   | Lig QID'i (`^Q\d+$`); yalnızca o ligin kulüpleri |

```jsonc
// 200 OK
{
  "data": [
    {
      "id": "clx…",
      "name": "Galatasaray S.K.",
      "shortName": "Galatasaray",
      "country": "TR",
      "crestUrl": "https://…",
    },
  ],
}
```

**`league` neden QID, veritabanı kimliği değil.** Kulüp kimlikleri (`cuid`) her ETL koşusunda değişir; §9.1'de ızgara havuzunun QID ile sabitlenmesinin sebebi de budur. Bir süzgeç değeri adres çubuğuna, yer imine ya da paylaşılan bir bağlantıya girebildiği için **koşudan koşuya sabit kalmak zorundadır**. `q` ve `limit` gibi geçici parametrelerden farkı bu.

**Lig listesinin kendisi bu uçtan GELMEZ.** Sayfa sunucuda render ediliyor ve 24 liglik künye orada zaten elde (§6.1'in tüketicisi `page.tsx`, kendi API'sine HTTP atmıyor). Ayrı bir `/api/leagues` ucu açmak; yeni bir hız sınırı yüzeyi, yeni bir doğrulama şeması ve ilk açılışta fazladan bir gidiş-dönüş demekti. Liste bileşene **özellik olarak** geçirilir.

Lig künyesi kulüp sayısını da taşır (`clubCount`) ve bu sayı **seçilebilir** kulüpleri sayar — kullanıcı listede yalnızca onları görebildiği için başka bir sayı göstermek yanlış beklenti kurardı.

### 6.2 `GET /api/common-players`

| Parametre      | Tip     | Zorunlu | Kural                                   |
| -------------- | ------- | ------- | --------------------------------------- |
| `clubA`        | string  | evet    | Geçerli kulüp id'si, `clubB`'den farklı |
| `clubB`        | string  | evet    | Geçerli kulüp id'si                     |
| `includeYouth` | boolean | hayır   | varsayılan `false`                      |
| `includeLoans` | boolean | hayır   | varsayılan `true`                       |

```jsonc
// 200 OK
{
  "data": {
    "clubA": { "id": "…", "shortName": "Galatasaray", "crestUrl": "…" },
    "clubB": { "id": "…", "shortName": "Arsenal", "crestUrl": "…" },
    "count": 3,
    "degenerate": null, // BR-36 — dejenere değilse null
    "players": [
      {
        "id": "…",
        "name": "Emmanuel Eboué",
        "nationality": "CI",
        "position": "Defans",
        "spellsAtA": [
          {
            "startYear": 2011,
            "endYear": 2014,
            "isLoan": false,
            "appearances": 64,
            "goals": 3,
            "hasEvidence": true,
          },
        ],
        "spellsAtB": [
          {
            "startYear": 2005,
            "endYear": 2011,
            "isLoan": false,
            "appearances": 214,
            "goals": 9,
            "hasEvidence": true,
          },
        ],
      },
    ],
  },
}
```

**`hasEvidence` (BR-8).** Dört alanın (`startYear`, `endYear`, `appearances`, `goals`) hiçbiri dolu değilse `false` olur. Kuralı istemcinin türetmesi de mümkündü; kasten sunucuda tutuluyor, çünkü bu bir **iş kuralıdır** ve iki yerde ayrı ayrı yazılırsa er geç ayrışır (§2.4 ile aynı gerekçe: karar tek yerde verilir).

**`degenerate` (BR-36).** Çift dejenere değilse `null`; dejenere ise ölçümün kendisi döner:

```jsonc
"degenerate": {
  "sharedPlayers": 52, // ortak oyuncu
  "smallerClubPlayers": 65, // küçük kulübün tekil oyuncu sayısı
  "smallerClubName": "Condal", // uyarı cümlesinde geçen ad
}
```

Oran **hesaplanıp gönderilmez**, iki sayı gönderilir. Arayüz "65 oyuncusunun 52'si" diye yazabilmeli; tek bir yüzde bu cümleyi kuramaz ve kullanıcı ham sayıları görmeden iddiayı denetleyemez. Karar (eşik) sunucuda, ifade istemcide — `hasEvidence` ile aynı bölüşüm.

Alan **kimlik iddiası taşımaz.** BR-36 gereği tetiklenen çiftlerin bir kısmı gerçekten ayrı kulüptür; sözleşme yalnızca ölçülen olguyu taşır, yorumu değil.

`playerCount` denominatörü **sabit tanımlıdır** (altyapı dışı tekil oyuncu) ve `includeYouth` / `includeLoans` ile değişmez. Bu bilinçli: kullanıcı süzgeci daralttığında pay küçülür, payda sabit kalır, yani oran **düşer**. Süzgeç uyarıyı bastırabilir ama **doğuramaz** — yanlış tarafa kaçan bir hata yok.

**`isCurrent` neden yok.** Faz 1 şemasında bu alan vardı ve "oyuncu hâlâ kulüpte" diye okunuyordu. Faz 4'te ölçüldü: alan gerçekte "Wikidata'da bitiş tarihi girilmemiş" demek. Man United'ın "güncel kadrosunda" Herbert Broomfield (1909) ve Harold Hardman (1912), Bayern'inkinde Paul Francke (1899) çıkıyor; 32.102 dönemde bitiş tarihi eksik. Yanlış olduğu **bilinen** bir alanı sözleşmede tutmak, onu tüketen herkes için tuzaktır — alan sözleşmeden çıkarıldı. Ham değer veritabanında duruyor (ileride güvenilir bir kaynakla düzeltilebilir), ama dışarı verilmiyor. Bitişi bilinmeyen dönem arayüzde `2011 – ?` olarak gösterilir.

**`position` kapalı bir kümedir**: `Kaleci`, `Defans`, `Orta saha`, `Kanat`, `Forvet` ya da `null`. Wikidata'nın `P413` alanı yalnızca futbol mevkisi taşımıyor; normalizasyon tanımadığı etiketi bir dönem ham hâliyle geçirdi ve veri kümesine bir bakanlık ("İçişleri Bakanlığı (İngiltere)"), bir kişi adı, çözülememiş bir QID ve kriket/ragbi/voleybol mevkileri girdi. Tanınmayan etiket artık `null` olur ve `db:verify` kümenin dışına çıkılmadığını denetler (§8.2).

### 6.3 Hata Biçimi

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR", // makine tarafından okunur
    "message": "clubA ve clubB aynı olamaz.", // kullanıcıya gösterilebilir
    "traceId": "01J…", // sunucu loguyla eşleşir
  },
}
```

| Kod                | HTTP | Anlam                                   |
| ------------------ | ---- | --------------------------------------- |
| `VALIDATION_ERROR` | 400  | Girdi şemaya uymuyor                    |
| `NOT_FOUND`        | 404  | Kulüp id'si yok                         |
| `RATE_LIMITED`     | 429  | İstek limiti aşıldı (`Retry-After` var) |
| `INTERNAL_ERROR`   | 500  | Beklenmeyen hata — **detay sızmaz**     |

**Kural:** `INTERNAL_ERROR` yanıtı asla istisna mesajı, yığın izi (stack trace), SQL parçası veya dosya yolu içermez. Bunlar yalnızca sunucu loguna `traceId` ile yazılır.

### 6.4 Izgara uçları

Beşi de 3×3 ızgara modunundur (§9.1). Üçü okuma, ikisi cevap doğrulama — ikinci cevap ucunun neden ayrı durduğu aşağıda.

#### `GET /api/grid`

**Parametresi yoktur.** Izgara tarihten türetilir (BR-11) ve tarihi **sunucu** okur; istemcinin gün seçebilmesi, yarının ızgarasını bugünden çekmek ya da geçmiş bir günü tekrar oynamak demekti.

```jsonc
// 200 OK — önbelleklenebilir (§7.9)
{
  "data": {
    "date": "2026-07-31", // UTC
    "rows": [
      { "kind": "club", "label": "Barcelona" },
      { "kind": "nationality", "label": "Brezilya" },
      { "kind": "club", "label": "Milan" },
    ],
    "columns": [
      { "kind": "club", "label": "Arsenal" },
      { "kind": "club", "label": "Inter" },
      { "kind": "club", "label": "Galatasaray" },
    ],
  },
}
```

**Sızıntı kuralı.** Yanıt cevapları taşımaz, hücre başına cevap **sayısını** da taşımaz (sayı tahmin alanını daraltan bir ipucudur) ve kriterin **kimliğini** de taşımaz — kulüp id'si ya da ülke kodu verilseydi istemci kesişimi kendisi hesaplayabilirdi.

#### `POST /api/grid/answer`

| Alan          | Tip    | Zorunlu | Kural                 |
| ------------- | ------ | ------- | --------------------- |
| `cell.row`    | int    | evet    | 0–2                   |
| `cell.column` | int    | evet    | 0–2                   |
| `playerId`    | string | evet    | Geçerli kimlik biçimi |

```jsonc
// 200 OK — ÖNBELLEKLENMEZ
{ "data": { "correct": true } }
```

**Neden POST.** İşlem sunucu durumunu değiştirmiyor, yani GET de olabilirdi. POST seçildi çünkü cevap denemeleri kullanıcının **oyun ilerleyişidir**: GET olsaydı her deneme tarayıcı geçmişine, sunucu erişim loglarına ve paylaşılan önbelleğe URL olarak yazılırdı — aynı ızgarayı henüz oynamamış birinin başkasının denemelerini bir kayıttan okuyabilmesi demek.

**İstemcinin kriterlerine güvenilmez (BR-12).** Gövde yalnızca hücre koordinatı ve oyuncu kimliği taşır; hangi kriterin hangi hücrede olduğunu sunucu ızgarayı **yeniden üreterek** bulur. İstemci kriter gönderebilseydi kendi ızgarasını uydurup her cevabı doğru yaptırabilirdi.

**Var olmayan kimlik `404` değil `correct:false` döner.** 404 dönmek, hangi kimliklerin var olduğunu ayırt etmeyi — yani numaralandırmayı — mümkün kılardı.

#### `GET /api/grid/criteria`

"Sen kur" ızgarasında bir eksene konabilecek ölçütler (BR-25).

| Parametre | Tip    | Zorunlu  | Kural                                     |
| --------- | ------ | -------- | ----------------------------------------- |
| `with`    | string | **evet** | `club:<kimlik>` ya da `nationality:<KOD>` |
| `q`       | string | hayır    | 0–50 karakter; boşsa süzgeçsiz ilk liste  |

`with` **tekrar edebilir** (en çok üç); seçilmiş sütunları taşır.

```jsonc
// 200 OK — önbelleklenebilir
{
  "data": [
    { "kind": "nationality", "id": "BR", "label": "Brezilya" },
    { "kind": "club", "id": "cms3tva…", "label": "Ajax" },
  ],
}
```

**Kimlik BURADA verilir**, günün ızgarasının aksine — ve bu bir sızıntı değil: kullanıcı ızgarayı kendisi kuruyor, kesişimi zaten kendisi seçiyor. Verilmeseydi cevap ucu hangi ölçütün sorulduğunu bilemezdi.

**Cevap SAYISI yine verilmez.** Liste yalnızca "bu ölçüt konabilir" der; hücrede kaç cevap olduğu, kullanıcı ızgarayı kendisi kursa bile oyunun kendi elinden alınması olurdu (§9.1 sızıntı kuralı).

**Ölçüldü (§9.1):** çağrı, ölçüt başına bir sayım sorgusu atar. En kötü durumda (5 sütun) soğuk p95 134–152 ms; kısıtlar önbelleklendiği için kullanıcının yazarken ödediği p95 **1,6 ms**. Kapı 250 ms'dir ve gerekçesi §9.1'de. `npm run bench` bu ucu kalıcı olarak ölçer.

#### `POST /api/grid/custom-answer`

| Alan          | Tip    | Zorunlu | Kural                                 |
| ------------- | ------ | ------- | ------------------------------------- |
| `row.kind`    | string | evet    | `club` ya da `nationality`            |
| `row.id`      | string | evet    | Kulüp kimliği ya da alpha-2 ülke kodu |
| `column.kind` | string | evet    | `club` ya da `nationality`            |
| `column.id`   | string | evet    | Kulüp kimliği ya da alpha-2 ülke kodu |
| `playerId`    | string | evet    | Geçerli kimlik biçimi                 |

```jsonc
// 200 OK — ÖNBELLEKLENMEZ
{ "data": { "correct": true } }
```

**NEDEN AYRI BİR UÇ** (`/api/grid/answer` ile birleştirilmedi): orada ölçütler tohumdan yeniden üretilir ve istemciden geleni kimse dinlemez (BR-11/BR-12), burada ölçütler gövdeden gelir (BR-26). "Ölçütlere güvenilir mi" sorusunun cevabı bir **uç noktanın sözleşmesi** olmalı, gövdedeki bir alanın varlığı değil.

**Hücre koordinatı GÖNDERİLMEZ.** Sunucu ızgaranın yerleşimini bilmiyor; doğruladığı şey "bu oyuncu bu iki ölçütü birden sağlıyor mu" sorusudur.

**Geçersiz ölçüt `400` döner** ve sebebi gövdededir: bulunamayan/seçilemez kulüp, biçimsiz ülke kodu, ya da satır ile sütunun aynı ölçüt olması. Sessizce `correct:false` dönmek, kullanıcının kendi kurduğu ızgarada neden hep yanıldığını anlamamasına yol açardı.

#### `GET /api/players`

| Parametre | Tip    | Zorunlu  | Kural                                  |
| --------- | ------ | -------- | -------------------------------------- |
| `q`       | string | **evet** | 2–50 karakter                          |
| `limit`   | int    | hayır    | 1–20, varsayılan 10                    |
| `stat`    | string | hayır    | §6.5'teki altı anahtardan biri (BR-16) |

```jsonc
// 200 OK
{
  "data": [
    {
      "id": "clx…",
      "name": "Esteban Cambiasso",
      "nationality": "AR",
      "position": "Orta saha",
    },
  ],
}
```

`q` burada **zorunludur**, kulüp aramasındaki gibi isteğe bağlı değil: 76.358 kayıtlık bir tabloda "hepsini listele" anlamlı bir istek olamaz. İki karakterden kısa metin boş liste döner — bu bir kural ihlali değil, henüz tamamlanmamış bir girdidir.

**Yanıt oyuncunun kulüp geçmişini taşımaz.** Taşısaydı arama kutusu ızgaranın cevap anahtarına dönüşürdü. `nationality` ve `position` kalır çünkü aynı adı taşıyan iki oyuncuyu ayırt etmek gerekir; ikisi de ızgara kriteri olabildiği için küçük bir ipucu taşırlar — kabul edilen bir maliyet, alternatifi ayırt edilemeyen bir listedir.

**`stat` neden var (BR-16).** İstatistik eşleştirme modunda bir cevabın puanlanabilmesi için o oyuncunun o istatistiğinin dolu olması gerekir. Süzgeç olmadan seçici, olmayanları da listeliyordu ve arama alfabetik sıralı: `q=Buffon` önce hiç verisi olmayan **Armando Buffon**'u getiriyor, kullanıcı onu seçiyor, sunucu haklı olarak reddediyordu. Süzgeçle aynı arama **Gianluigi** ve **Lorenzo Buffon**'u döndürüyor.

Izgara modu bu alanı **göndermez**: orada her oyuncu geçerli bir cevaptır. Tanınmayan bir `stat` değeri sessizce yok sayılmaz, `400` döner — yazım hatası süzgeci sessizce kapatıp kullanıcıyı seçemeyeceği oyuncularla baş başa bırakırdı.

**Süzgecin ölçütü `POST /api/stat-match/answer` ile BİREBİR aynıdır.** İlk uygulamada değildi: süzgeç "en az bir dolu dönem" derken doğrulama "hiçbir dönem eksik olmasın" diyordu ve seçicinin gösterdiği oyuncu reddediliyordu — yani süzgecin kaldırmak için eklendiği duvarın aynısı. Entegrasyon testi bunu yakaladı.

### 6.5 İstatistik eşleştirme uçları

§9.2'nin iki ucu. Izgara uçlarıyla aynı iki kural geçerlidir: tarihi sunucu okur, doğrulamayı sunucu yapar.

#### `GET /api/stat-match`

Parametresi yoktur (BR-19).

```jsonc
// 200 OK — önbelleklenebilir (§7.9)
{
  "data": {
    "date": "2026-07-31",
    "player": { "id": "clx…", "name": "Éric Cantona", "nationality": "FR" },
    "stats": [
      {
        "key": "appearances",
        "label": "Kulüp maçı",
        "value": 194,
        "scoped": true,
      },
      { "key": "goals", "label": "Kulüp golü", "value": 83, "scoped": true },
      { "key": "clubs", "label": "Oynadığı kulüp", "value": 3, "scoped": true },
      {
        "key": "nationalCaps",
        "label": "A millî maç",
        "value": 45,
        "scoped": false,
      },
      { "key": "heightCm", "label": "Boy (cm)", "value": 188, "scoped": false },
      { "key": "weightKg", "label": "Kilo (kg)", "value": 86, "scoped": false },
    ],
  },
}
```

**Hedef değerler AÇIKÇA verilir** — ızgaranın tersine. Orada değerleri saklamak oyunun kendisiydi; burada oyun "bu değere yakın başka kimi biliyorsun" sorusudur ve hedef gizlenirse soru sorulamaz (§2.4 sızıntı kuralı, sunulan bilgi için geçerli değildir).

`scoped: true`, o sayının **yalnızca §1.3'teki yirmi dört ligi** kapsadığını söyler. Arayüz bunu göstermek zorundadır.

#### `POST /api/stat-match/answer`

| Alan       | Tip    | Zorunlu | Kural                           |
| ---------- | ------ | ------- | ------------------------------- |
| `statKey`  | string | evet    | Yukarıdaki altı anahtardan biri |
| `playerId` | string | evet    | Geçerli kimlik biçimi           |

```jsonc
// 200 OK — ÖNBELLEKLENMEZ
{
  "data": {
    "value": 172, // seçilen oyuncunun o istatistikteki değeri
    "score": 88, // BR-18 formülüyle, 0–100
  },
}
```

**Puanı sunucu hesaplar (BR-20).** İstemci hedef değeri gönderemez; gönderebilseydi kendi hedefini uydurup %100 alırdı. Seçilen oyuncunun **değeri** yanıta girer — kullanıcı zaten "ne kadar yaklaştım" sorusunun cevabını hak eder ve bu, oyunun sunulan parçasıdır.

Seçilen oyuncunun o istatistiği **boşsa** `VALIDATION_ERROR` döner (BR-16): puanlanamayan bir seçim sessizce 0 sayılmaz, reddedilir.

### 6.6 "Hangisi daha" uçları

§9.3'ün iki ucu. Buradaki ayırt edici kural **BR-32**'dir: tur yanıtı sayı taşımaz.

#### `POST /api/hangisi-daha/round`

Yeni bir tur ister. `GET` değil çünkü dışlama listesi (`exclude`) uzundur ve URL'e sığmaz; ayrıca yanıt önbelleklenMEMELİDİR — aynı istek her seferinde farklı bir rakip vermelidir.

| Alan        | Tip      | Zorunlu | Kural                                               |
| ----------- | -------- | ------- | --------------------------------------------------- |
| `statKey`   | string   | evet    | §9.2'nin altı anahtarından biri                     |
| `stayingId` | string   | hayır   | Kalan oyuncu (BR-28). Yoksa turun İLK çifti kurulur |
| `exclude`   | string[] | hayır   | Bu koşuda görülmüş oyuncular; en çok 200 kimlik     |

`direction` **girdide yoktur**: yön yalnızca cevabın hangi tarafının doğru sayılacağını belirler ve o karar sunucuda, cevap ucunda verilir. Tur ucuna taşınsaydı iki uç arasında tutarlılığı kimse zorlamazdı.

```jsonc
// 200 OK — ÖNBELLEKLENMEZ
{
  "data": {
    "statKey": "goals",
    "pair": {
      "left": {
        "id": "clx…",
        "name": "Didier Drogba",
        "clubs": ["Chelsea", "Marsilya"],
      },
      "right": {
        "id": "cly…",
        "name": "Thierry Henry",
        "clubs": ["Arsenal", "Barcelona"],
      },
    },
  },
}
```

**Sayı yok** (BR-32). Kulüp adları oyuncuyu tanıtmak için verilir; karşılaştırılan istatistiğin değeri değildir.

**Havuz tükenirse `pair: null` döner — hata DEĞİL.** Koşu uzadıkça görülen oyuncular dışlanır (BR-28) ve sonunda BR-29 bandını sağlayan aday kalmaz; bu beklenen bir sondur, arayüz koşuyu skorla bitirir. Bir hata kodu döndürmek, oyunun normal akışını §6.3'ün hata sözleşmesine sokardı. Band sessizce gevşetilerek tur da kurtarılmaz: sunucunun kurmayacağı bir çifti cevap ucu zaten reddederdi.

Ayrım şurada: `stayingId` ve `exclude` **boşken** hiç aday bulunamazsa bu havuzun tükenmesi değil, veri kümesinin bozulmasıdır (`heightCm` hiç çekilmemiş gibi). O hâlde `ROUND_UNAVAILABLE` fırlatılır ve §6.3 gereği `500` olur — `GRID_UNAVAILABLE` ile aynı sınıf.

#### `POST /api/hangisi-daha/answer`

| Alan        | Tip    | Zorunlu | Kural                           |
| ----------- | ------ | ------- | ------------------------------- |
| `statKey`   | string | evet    | Altı anahtardan biri            |
| `direction` | string | evet    | `"more"` \| `"less"`            |
| `leftId`    | string | evet    | Turda sunulan sol oyuncu        |
| `rightId`   | string | evet    | Turda sunulan sağ oyuncu        |
| `chosenId`  | string | evet    | `leftId` ya da `rightId` olmalı |

```jsonc
// 200 OK — ÖNBELLEKLENMEZ
{
  "data": {
    "correct": true,
    "left": { "id": "clx…", "value": 164 },
    "right": { "id": "cly…", "value": 175 },
    "winnerId": "cly…", // BR-28: doğruysa bir sonraki turda kalan
    "scoped": true, // §9.2'deki kapsam bildirimi
  },
}
```

**Doğruyu sunucu belirler (BR-32).** İki değer de yanıta girer çünkü cevap verildikten sonra kullanıcı ne kadar yanıldığını görmeyi hak eder — §6.5'teki `value` ile aynı gerekçe.

İki oyuncudan birinin o istatistiği **boşsa** ya da aralarındaki fark BR-29 bandının altındaysa `VALIDATION_ERROR` döner: sunucunun kurmayacağı bir çift, cevap ucunda da kabul edilmez (§9.1'in "süzgeç ile doğrulayıcı aynı olmalı" kuralı).

---

## 7. Güvenlik

Tehdit modeli: uygulama **kimliği doğrulanmamış, herkese açık, salt-okunur** bir servistir. Kullanıcı verisi tutulmaz. Bu, saldırı yüzeyini bilinçli olarak küçültme kararıdır.

### 7.1 Girdi Doğrulama

- Her route handler ilk satırında `schema.safeParse()` çağırır; başarısızsa `400` döner.
- Uzunluk üst sınırları zorunludur (`q` ≤ 50 karakter) — kaynak tüketim saldırısına karşı.
- `limit` gibi sayısal alanlar üst sınırla kelepçelenir; istemcinin verdiği değere güvenilmez.

### 7.2 Enjeksiyon

- **SQL:** Yalnızca Prisma sorgu kurucusu kullanılır. Ham SQL gerekiyorsa `Prisma.sql` etiketli şablonu zorunludur; dize birleştirme ile SQL üretmek yasaktır (ESLint kuralıyla engellenir).
- **XSS:** React varsayılan kaçışı kullanılır. `dangerouslySetInnerHTML` kod tabanında yasaktır (ESLint `react/no-danger`).
- **Komut enjeksiyonu:** Uygulama alt süreç (`child_process`) çalıştırmaz.

### 7.3 HTTP Güvenlik Başlıkları

Başlıklar iki yere bölünmüştür: **sabit** olanlar `next.config.ts`'de, **istek başına değişen** CSP ise `src/proxy.ts`'de üretilir.

#### Sabit başlıklar (`next.config.ts`)

| Başlık                         | Değer                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`                                     |
| `X-Content-Type-Options`       | `nosniff`                                                                          |
| `X-Frame-Options`              | `DENY`                                                                             |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                  |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                      |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                      |
| `X-DNS-Prefetch-Control`       | `off`                                                                              |

Ayrıca `poweredByHeader: false` ile `X-Powered-By` kaldırılır (sunucu parmak izini azaltır).

#### CSP — nonce tabanlı (`src/proxy.ts`)

```
default-src 'self';
script-src 'self' 'nonce-<istek başına rastgele>' 'strict-dynamic' [dev: 'unsafe-eval'];
style-src 'self' 'nonce-<…>'          [dev: 'unsafe-inline'];
style-src-attr 'unsafe-inline';
img-src 'self' https://upload.wikimedia.org blob: data:;
font-src 'self'; connect-src 'self'   [dev: ws: wss:];
object-src 'none'; frame-src 'none'; frame-ancestors 'none';
base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

Nonce her istekte 128 bit Web Crypto rastgeleliğiyle üretilir. **Sabitlenmesi koruma değerini tamamen yok eder** — saldırganın enjekte ettiği script'in çalışmaması, nonce'u önceden bilememesine dayanır.

#### Bu tasarımın üç sonucu

1. **Dinamik render zorunludur.** Next, nonce'u istek başlığından okuyup script etiketlerine ekler. Statik üretimde istek yoktur, nonce da yoktur; `'strict-dynamic'` ise `'self'`'i geçersiz kıldığı için sayfadaki **tüm** script'ler bloklanır. Bu yüzden kök layout'ta `await connection()` çağrılır ve ağaç isteğe bağlı render'a zorlanır. Bedeli statik optimizasyon ve CDN önbelleklemesidir; uygulama zaten her isteği veritabanından karşıladığı için kabul edilmiştir.
2. **`style-src-attr 'unsafe-inline'` bilinçli bir tavizdir.** `next/image` her görsele `style="color:transparent"` basar ve özniteliklere nonce eklenemez. Bu direktif yalnızca `style="..."` özniteliklerini kapsar; `<style>` blokları ve harici stil sayfaları katı `style-src` kuralına tabidir. Kod çalıştırma riski yoktur.
3. **`'unsafe-eval'` yalnızca geliştirmededir.** React, sunucu hata yığınlarını tarayıcıda yeniden kurmak için `eval` kullanır. Üretim çıktısında bu direktif yer almaz.

#### Doğrulama

Denetim, CSP veya render moduna dokunan her değişiklikten sonra üretim derlemesi üzerinde tekrarlanır.

| Ölçüm                               | Faz 0   | Faz 3 (arayüz ve API eklendikten sonra) |
| ----------------------------------- | ------- | --------------------------------------- |
| Nonce'lu script / toplam script     | 11 / 11 | **15 / 15** (Faz 4 ölçümü)              |
| Üç istekte benzersiz nonce          | 3 / 3   | **3 / 3**                               |
| Üretimde `unsafe-eval`              | yok     | **yok**                                 |
| Üretimde `script-src unsafe-inline` | yok     | **yok**                                 |
| İzinsiz kökenli `<img>`             | —       | **0** (12 arma, hepsi `upload.…`)       |

#### `style-src-attr` tavizinin durumu

Faz 3'te ölçüldü: sayfada **0 adet** `style="..."` özniteliği ve **0 adet** `<style>` bloğu var. Taviz şu an ATIL. Faz 4'te armalar eklendi ama `next/image` KULLANILMADI (aşağıya bkz.), dolayısıyla direktif hâlâ tetiklenmiyor. Kaldırılmadı: bir sonraki görsel ihtiyacında sessizce kırılan bir CSP'yi teşhis etmek, atıl bir direktifi taşımaktan pahalıdır. Direktifin kod çalıştırma riski yoktur (yalnızca öznitelikleri kapsar).

#### Görsel kaynakları

Kulüp armaları yalnızca `upload.wikimedia.org` alanından yüklenir; kural hem CSP `img-src`'de hem `next.config.ts` içindeki `images.remotePatterns` beyaz listesinde tanımlıdır. Rastgele URL'den görsel yüklenmesine izin verilmez — aksi hâlde görsel optimizasyon ucu bir SSRF aracına dönüşür.

> **Alan adı beyaz listesi LİSANSI DENETLEMEZ.** `upload.wikimedia.org` hem Commons'ın özgür dosyalarını hem tek tek Vikipedilere yüklenmiş **adil kullanım** dosyalarını sunar; ikisi de aynı konaktan gelir ve yol dışında hiçbir farkları yoktur. Yani güvenlik beyaz listesi geçilmiş olması "bu görseli kullanabiliriz" demek değildir. Lisans denetimi ETL'de yapılır (§4.3.1, BR-33) ve `db:verify` ile ölçülür.

#### Görsel atfı

Armaların bir kısmı **CC BY / CC BY-SA** lisanslıdır ve bu lisanslar atıf ister: yazar adı, lisans adı ve dosya sayfasına bağlantı. Ölçüldü (2026-08-08, 40 kulüplük örneklem): armaların **%20'si** atıf zorunlu, %80'i kamu malı.

Atıf `/kaynaklar` sayfasında toplanır ve altbilgiden her sayfaya bağlanır. Kaynak künyesi veriyle birlikte taşınır (`Club.crestLicense`, `crestAuthor`, `crestFilePage`) — arayüzde elle yazılan bir liste, veri tazelendiğinde sessizce yanlışa döner.

> **Bu açık YAYINDA DEĞİL, ama vardı.** Armalar Faz 4'te eklendiğinde atıf yükümlülüğü fark edilmedi; §4.3'ün "olgular telife tabi değildir" gerekçesinin görselleri de kapsadığı sanıldı. Ölçüm bunu çürüttü ve açık Faz 4.11'de kapatıldı. Kayda geçiyor ki bir sonraki görsel türü (oyuncu fotoğrafı) eklenirken aynı hata tekrarlanmasın — fotoğraflarda atıf oranı çok daha yüksek: ölçülen **%88**.

> **Faz 3'te ölçülen uyumsuzluk ÇÖZÜLDÜ (Faz 4).** Sorun ikiliydi: veri `http://commons.wikimedia.org/wiki/Special:FilePath/…` biçimindeydi (114 armanın 114'ü) **ve** hiçbir bileşen armaları render etmiyordu. İkisi de düzeltildi — ETL adresi `upload.wikimedia.org`'a normalize ediyor (`scripts/etl/pipeline/crest-url.ts`), `ClubCrest` bileşeni gösteriyor.
>
> **Beyaz liste GENİŞLETİLMEDİ, veri düzeltildi.** `commons.wikimedia.org` eklemek iki satırlık bir düzeltme olurdu ama yanlış yönde: `Special:FilePath` bir yönlendirmedir (her arma için fazladan gidiş-dönüş) ve `http` karışık içerik uyarısı üretir. Güvenlik sınırını veri hatasına uydurmak yerine veri sınıra uyduruldu.
>
> **Ölçülmüş kısıt:** Wikimedia keyfi küçük-resim genişliği kabul etmiyor. İlk deneme 96 px'di ve 114 adresin tamamı `400` döndü ("Use thumbnail sizes listed on https://w.wiki/GHai"). Ölçüm: 64 ✗, 96 ✗, 100 ✗, **120 ✓**, 128 ✗, 160 ✗, 200 ✗, **250 ✓**, 256 ✗, 320 ✗. SVG'ler (114'ün 78'i) doğrudan veriliyor — hem daha küçük (4,4 KB vs 16,8 KB) hem ölçeklenebilir; raster dosyalar 120 px küçük resim olarak.
>
> **`next/image` kullanılMIYOR.** Dosyalar ETL'de zaten küçültüldüğü için görsel iyileştiricinin ölçülebilir kazancı yok; devreye almak bir alt sistem ve çalışma zamanı dönüştürme adımı eklerdi. `images.remotePatterns` yine de duruyor: ileride iyileştirici kullanılırsa beyaz listenin ilk günden dar olması gerekir.

### 7.4 Dış Servis Yalıtımı

Wikidata'ya **yalnızca** `scripts/etl/` erişir. Çalışma zamanında (request path) hiçbir dış ağ çağrısı yoktur. Kazanç:

- SSRF ve dış servis kaynaklı gecikme/kesinti riski ortadan kalkar,
- üçüncü taraf yanıtı doğrudan kullanıcıya asla yansımaz,
- ETL'de gelen her kayıt Zod ile doğrulandığı için "kirli veri" veritabanına giremez.

**Kuralın kapsamı: İSTEK YOLU.** Yasaklanan şey, bir kullanıcı isteğinin dış bir servise gitmesidir. Derleme adımı istek yolu değildir ve `scripts/fetch-dataset.ts` orada çalışır: veri kümesini yayımlanmış sürüm varlığından indirir (§3.1). Ayrım keyfi değil, tehdide dayalı — derleme çıktısı dağıtılmadan önce doğrulanabilir ve tekrarlanabilirdir; bir istek anında yapılan çağrı ise kullanıcının gecikmesine, kesintisine ve SSRF yüzeyine doğrudan eklenir.

Betik, yarım veya yanlış bir indirmeyi kabul etmez: geçici dosyaya yazar, boyutu denetler, ancak sonra yerine taşır. Veri inmezse **derleme durur** — boş bir veritabanıyla devam etmek, çalışıyor görünen ama hiçbir kulübü bulamayan bir site üretirdi.

### 7.5 İstek Hızı Sınırlama

Her API ucunda IP başına token bucket: **60 istek / dakika**, patlama toleransı 10. Aşımda `429` + `Retry-After`. Sabit pencere yerine token bucket seçildi: sabit pencere, pencere sınırında limitin iki katına izin verir.

**İstemci kimliği nasıl bulunur.** `X-Forwarded-For` istemcinin YAZABİLDİĞİ bir başlıktır; ham hâline güvenmek sınırlamayı tamamen etkisiz kılar. Her ters vekil başlığa kendi gördüğü adresi ekler; önümüzde `TRUSTED_PROXY_HOPS` kadar güvenilen vekil varsa **sondan o kadarıncı** giriş bizim altyapımızın yazdığı ilk değerdir. Soldaki her şey uydurulmuş olabilir ve atılır.

`TRUSTED_PROXY_HOPS=0` (doğrudan internete açık) durumunda başlık tamamen yok sayılır ve sınır sunucu geneline düşer. Yanlış olduğu bilinen bir başlığa güvenip sınırlamayı işlevsiz kılmaktansa, daha kaba ama gerçekten uygulanan bir sınır yeğdir.

**Bellek sınırı.** Anahtar istemciden geldiği için kova haritası sınırsız büyüyemez; aksi hâlde sınırlayıcının kendisi bir bellek tüketim aracı olur (§7.1). Sınıra ulaşıldığında yalnızca **kovası dolu** (yani atıl) anahtarlar atılır. İlk tasarımda "en eskiyi at" kuralı vardı ve YANLIŞTI: jetonu tükenmiş bir kovayı silmek, tam da sınırlanan istemciye temiz bir kova hediye ediyordu. Bunu bir test yakaladı; kural artık "tahliye asla kota kazandırmaz". Atılabilecek atıl kova yoksa yeni anahtarlar ortak bir taşma kovasını paylaşır.

**Sunucusuzda sınırlayıcının rolü (Faz 4 kararı).** Vercel'de her fonksiyon örneğinin kendi belleği vardır, dolayısıyla bellek içi kova **örnek başına** çalışır: N örnek varsa etkin sınır N×60/dk olur. Bu, sınırlayıcıyı tek başına yetersiz kılar ve karar bilinçlidir:

- **Asıl koruma önbellektir** (§7.9). Yanıtlar CDN'de tutulduğu için tekrarlayan istekler fonksiyona hiç ulaşmaz; sınırlayıcı yalnızca önbellek ıskalayan trafiği görür.
- **Korunacak bir yazma yolu veya kişisel veri yok.** Uygulama veritabanına yazmıyor (§3.1) ve kimlik tutmuyor; sınırlayıcının koruduğu şey bütünlük değil, kaynak tüketimidir.
- Bu hâliyle sınırlayıcı **tek savunma değil, katmanlardan biridir**.

Paylaşımlı bir sayaca (Vercel KV / Upstash vb.) geçiş, `RateLimiter` port'u arkasında olduğu için tek dosyalık değişikliktir. **Skor tablosu geldiğinde zorunlu olur** — orada yazma yolu ve kimlik devreye girer, yani sınırlayıcı bütünlüğü de korumaya başlar.

### 7.6 Sır Yönetimi

- `.env` **asla** commit edilmez; `.env.example` yalnızca anahtar adlarını içerir.
- `NEXT_PUBLIC_` öneki yalnızca gerçekten herkese açık değerler için kullanılır. Sır içeren bir değişkene bu önek verilmesi kod incelemesinde reddedilir.
- Ortam değişkenleri `infrastructure/config/env.ts` içinde Zod ile doğrulanır; eksik/geçersiz değişken varsa uygulama **başlamaz** (hızlı başarısızlık).

### 7.7 Bağımlılık Güvenliği

**Bloklayıcı kapı:** `npm run audit:ci` → `npm audit --omit=dev --audit-level=high`.
Üretim paketine giren ağaçta yüksek/kritik açık **sıfır** olmalıdır. CI bunu zorlar.

**Bilgilendirme:** `npm run audit:full` tüm ağacı (dev araçları dâhil) tarar. Bu komut CI'ı bloklamaz — gerekçesi aşağıdadır.

#### Uygulanan `overrides`

Geçişli bağımlılıklardaki açıklar, üst paketleri **düşürmek yerine** alt sürümleri yukarı sabitleyerek kapatıldı:

| Paket     | Zorlanan  | Kapatılan açık                                                    | Neden önemli                       |
| --------- | --------- | ----------------------------------------------------------------- | ---------------------------------- |
| `sharp`   | `^0.35.3` | libvips CVE-2026-33327/33328/35590/35591 (`GHSA-f88m-g3jw-g9cj`)  | **Çalışma zamanı** — görsel işleme |
| `postcss` | `^8.5.23` | sourceMappingURL üzerinden yol geçişi (`GHSA-r28c-9q8g-f849` vb.) | Derleme zamanı CSS işleme          |
| `nanoid`  | `^3.3.17` | özel üreteçte sonsuz döngü (`GHSA-2v37-7h3g-55p8`)                | Derleme zamanı — `next → postcss`  |

> **`nanoid` girdisi bir SÜRÜM ARALIĞI sorunu değil, KİLİT sorunuydu ve bu yüzden kayda değer.** `postcss@8.5.23` zaten `^3.3.16` istiyordu, yani yamalı sürüm aralığın içindeydi; `package-lock.json` sadece eski çözünürlükte (`3.3.16`) donmuştu. Bir `npm update` de kapatırdı. `overrides` yine de tercih edildi: aralık izin veriyor diye kilidin bir daha aşağı düşmeyeceğinin garantisi yok, ve tablo bu satırın neden var olduğunu taşıyor. Çözülen sürüm `3.3.18`.
>
> Bu açık **CI'ı dört itme boyunca kırmızı tuttu** (2026-08-08 → 09) ve sebebi bizim kodumuz değildi. Kayda geçiyor: `audit:ci` bloklayıcı bir kapıdır, dolayısıyla yukarı akıştaki bir uyarı yayımı derlemeyi durdurur. Beklenen davranış budur; müdahale de bu tablodaki gibi olur.

> `npm audit fix --force` **kullanılmaz**: önerdiği "düzeltme" `next@9.3.3` ve `eslint-config-next@12.0.4` gibi yıllar öncesine dönüşlerdir; net etkisi güvenliği azaltmaktır.

#### Kabul edilmiş istisna: `brace-expansion` (dev-only)

`GHSA-mh99-v99m-4gvg` (DoS, yüksek) `brace-expansion <= 5.0.7` aralığını kapsar ve **yalnızca 5.0.8** yamalıdır — 1.x/2.x hattına geri port edilmemiştir. `eslint-config-next`'in paketlediği `eslint-plugin-import`, `eslint-plugin-jsx-a11y` ve `eslint-plugin-react` ise `minimatch@3` üzerinden `brace-expansion@1.x` kullanır.

Denenen ve **reddedilen** çözümler:

1. **Global `brace-expansion: ^5.0.8` override'ı** → `TypeError: expand is not a function`. v5'in CommonJS derlemesi artık çağrılabilir bir varsayılan dışa aktarım vermiyor; `minimatch@3` kırılıyor.
2. **`minimatch`'i v9/v10'a yükseltmek** → tüketiciler `import minimatch from "minimatch"` (varsayılan import) kullanıyor, v9+ yalnızca adlandırılmış dışa aktarım sunuyor. Aynı kırılma.
3. **`eslint@10`'a geçmek** → `eslint-config-next@16.2.12` peer aralığı `>=9.0.0` dese de gerçekte uyumsuz: `eslint-plugin-react`, eslint 10'un kaldırdığı context API'sini kullanıyor (`contextOrFilename.getFilename is not a function`).

**Karar:** Açık kabul edilir ve izlenir. Gerekçe:

- Etkilenen paketler yalnızca `devDependencies` içindedir; **üretim paketine girmezler**.
- Saldırı vektörü kötü niyetli glob desenidir; buradaki desenler kendi lint yapılandırmamızdan gelir, dışarıdan girdi almaz.
- Yeniden değerlendirme koşulu: `eslint-config-next`, eslint 10 uyumlu eklentilerle yeni sürüm yayınladığında (§10.2'de izlenir).

#### Diğer kurallar

- Bağımlılıklar sabitlenir (`package-lock.json` commit edilir), CI'da `npm ci` kullanılır.
- Yeni bağımlılık eklemek gerekçe ister; küçük yardımcı paketler yerine yerel fonksiyon tercih edilir (tedarik zinciri yüzeyini küçültmek için).
- Kurulum betikleri (`postinstall`) npm'in `allow-scripts` mekanizmasıyla denetlenir; yalnızca gerçekten gerekli olanlara (Prisma motorları, esbuild ikilisi) izin verilir.

### 7.8 Diğer

- **CORS:** Varsayılan aynı-köken politikası korunur; `Access-Control-Allow-Origin: *` verilmez.
- **Loglama:** Log satırlarına IP, çerez veya tam istek gövdesi yazılmaz — yalnızca `traceId`, uç adı, süre ve sonuç kodu.
- **Kimlik doğrulama:** MVP'de yok. Eklendiğinde: `httpOnly` + `Secure` + `SameSite=Strict` çerez, sunucu tarafı oturum, CSRF token'ı.
- **Bağımlılık bütünlüğü:** Üretim yapısı çevrimdışı üretilebilir olmalı; derleme sırasında uzak betik indirilmez.

### 7.9 Önbellekleme

Faz 3'e kadar **her** API yanıtı `Cache-Control: no-store` taşıyordu. O tercih, önbelleklenebilirlik hakkında bir şey bilinmediği durumda doğru olan güvenli varsayımdı. §3.1'deki mimari kararla artık biliniyor: veri yalnızca yeni bir dağıtımla değişir, yani **bir dağıtım içinde yanıtlar değişmezdir**.

Önbelleklenebilirliğin koşulu üç maddedir ve üçü de sağlanıyor:

1. **Kişiselleştirme yok.** Yanıt yalnızca sorgu parametrelerine bağlı; oturum, çerez, kullanıcı yok. Aynı URL herkese aynı cevabı verir.
2. **Gizli veri yok.** Tüm veri kümesi zaten herkese açık (Wikidata).
3. **Değişmezlik.** Veri dağıtımlar arasında sabit.

**Uygulanan politika:**

| Yanıt                  | Politika                                          | Gerekçe                                                            |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `200` (veri)           | `public, s-maxage=<uzun>, stale-while-revalidate` | Dağıtım içinde değişmez                                            |
| `4xx` doğrulama hatası | `no-store`                                        | Kısa ömürlü ve istemciye özgü; önbellekte yer tutması anlamsız     |
| `429` hız sınırı       | `no-store`                                        | **Kritik:** önbelleklenirse başka istemcilere de 429 servis edilir |
| `5xx`                  | `no-store`                                        | Geçici durum; kalıcılaştırılmamalı                                 |

**Sayfa HTML'i önbelleklenmez.** Nonce'lu CSP (§7.3) her yanıtta yeni bir nonce üretir; önbelleklenmiş bir HTML, önbelleklenmiş bir nonce demektir ve bu, nonce'ı işlevsiz kılar. Sayfa kabuğu bu yüzden dinamik kalır — küçüktür, veri zaten API'den gelir.

> **İlk dağıtımda doğrulanacak:** Vercel'in CDN önbellek anahtarının dağıtım kimliğini içerdiği, yani yeni dağıtımın eski yanıtları otomatik geçersiz kıldığı varsayılıyor. Bu doğrulanana kadar `s-maxage` **temkinli** tutulur; doğrulandıktan sonra uzatılır. Varsayım yanlışsa yeni veri eski önbelleğin arkasında kalır — bu, sessizce yanlış veri servis etmek demektir ve ölçülmeden kabul edilemez.

### 7.10 Erişilebilirlik (WCAG 2.1 AA)

Denetim **iki parçadır**, çünkü tek bir araç ikisini birden ölçemiyor.

**1. Yapısal denetim — otomatik ve kalıcı.** `axe-core`, `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` kural kümeleriyle bileşenlerin üzerinde koşuyor ve testlerin parçası (`tests/unit/components/a11y.test.tsx`). Kulüp seçici hem kapalı hem **liste açıkken** denetleniyor — combobox deseninin `aria-*` bağlantıları ancak açıkken değerlendirilebilir.

> Denetimin kendisi de test ediliyor: bilerek bozuk bir işaretlemeye (`<img>` alt'sız, `<button>` adsız) karşı koşturulup ihlalleri **yakaladığı** doğrulanıyor. Hiç kırmızıya dönemeyen bir kapı kapı değildir.

**2. Kontrast — elle hesaplandı.** jsdom'un yerleşim motoru olmadığı için `color-contrast` kuralı orada çalışamaz; açık bırakılsaydı "geçti" derdi ve bu yanıltıcı olurdu. Kural bilerek kapatıldı, kontrast ayrıca hesaplandı.

> **Ölçümün kendisi §7.12'ye taşındı.** Arayüz artık `currentColor` üzerine saydamlıkla değil, adlandırılmış belirteçlerle kuruluyor; ölçüm de saydamlık değerlerinin değil, belirteç çiftlerinin tablosu. Aşağıdaki ilk denetim tarihsel kayıt olarak duruyor.

Saydamlık düzenindeki ilk ölçüm beş ihlal buldu ve beşi de düzeltildi:

| Yer                                | Neydi                      | Ne oldu           | Hangi ölçüt            |
| ---------------------------------- | -------------------------- | ----------------- | ---------------------- |
| Arama kutusu kenarlığı             | `border-current/20` (1,53) | `/50`             | 1.4.11 arayüz bileşeni |
| Arama kutusu odak halkası          | `ring-current/20` (1,53)   | `/60`             | 1.4.11 / 2.4.11 odak   |
| "Değiştir" ve "Yeniden dene" odağı | `ring-current/30` (1,96)   | `/60`             | 1.4.11 / 2.4.11 odak   |
| Hata kimliği metni                 | `opacity-50` (3,41)        | `/70`             | 1.4.3 metin kontrastı  |
| Boş sonuç açıklaması               | `opacity-50` + `text-xs`   | `/70` + `text-sm` | 1.4.3                  |

**Renk tek gösterge değildir (1.4.1).** BR-8'in kanıtsız dönem işareti kesik çizgiyle _ve_ metinle veriliyor ("kaynakta ayrıntı yok"); kiralık dönem rozeti de metin taşıyor. Izgarada doğru/yanlış hücreler "✓"/"✗" işareti ve ekran okuyucuya giden sözcükle ayrılıyor; istatistik ekranındaki puan rozetinde yüzde değerinin kendisi yazılı. Biçimi ya da rengi ayırt edemeyen kullanıcı için hiçbir yerde bilgi kaybolmuyor.

**Simge yerine sözcük (4.1.2).** Ortak oyuncu başlığı gözde `∩` gösteriyor ama erişilebilir adı `aria-label` ile veriliyor: "Galatasaray ve Arsenal, 12 ortak oyuncu". İki sebep var. Seslendiriciler `∩` karakterini tutarsız okuyor — kimi "kesişim" diyor, kimi tamamen atlıyor. İkincisi ölçüldü: ad iç içe elemanların metninden türetildiğinde aradaki boşluk CSS `display` değerine bağlı kalıyor ve `display` bilgisi olmayan bir ortamda "GalatasarayveArsenal12 ortak oyuncu" çıkıyor. Görsel `gap` erişilebilir ada yansımaz.

**Armalar süslemedir (1.1.1).** `alt=""` ve `aria-hidden` taşırlar; yanlarındaki kulüp adı zaten okunuyor, "Galatasaray arması" demek aynı bilgiyi ikinci kez seslendirmek olurdu.

**Bu denetimin DIŞINDA kalanlar — dürüstçe.** jsdom yerleşim hesaplamadığı için görünürlük, gerçek odak sırası, hedef boyutu (2.5.5) ve yeniden akış (1.4.10) ölçülmedi. Bunlar gerçek tarayıcı gerektirir ve ilk dağıtımdan sonra elle denetlenecektir (Faz 4.5).

### 7.11 Site Kimliği ve İndeksleme

**İndeksleme tek anahtarla yönetilir:** `SITE_INDEXABLE`. Hem `app/robots.ts` hem sayfa meta etiketi aynı değeri okur. İki ayrı yerde tutulsaydı biri açılıp diğeri kapalı kalabilir ve sonuç aylarca fark edilmeden yanlış olurdu.

**Varsayılan `false`.** Unutulan bir yapılandırma siteyi sessizce arama sonuçlarına sokmamalı; tersi zararsızdır. Değer `"true"`/`"false"` dizgisiyle sınırlı — `z.coerce.boolean()` KULLANILMAZ, çünkü o dönüşüm boş olmayan her dizgiyi `true` yapar ve `"false"` da `true` olurdu. Tanınmayan bir değerde uygulama başlamaz (§7.6).

**Neden hem `robots.txt` hem `noindex`.** `robots.txt` yalnızca **taramayı** engeller, indekslemeyi değil: dışarıdan bağlantı verilmiş bir adres, içeriği hiç okunmadan arama sonuçlarında görünebilir. İndekslemeyi asıl engelleyen `noindex` meta etiketidir. Bu aşamada siteye dışarıdan bağlantı olmadığı için ikisi birlikte kullanılıyor; tarama trafiğini baştan kesmenin de maliyeti yok.

**AYNI DEĞERİ OKUMAK YETMEDİ; AYNI ANDA okumaları gerekiyordu.** İlk sürümde
`robots.ts` derleme zamanında çözülüyordu: Next, `robots.js`'i öntanımlı
olarak **önbelleğe alıyor** (istek-anı API'si kullanmadıkça) ve gövde derleme
çıktısına gömülüyordu. Sayfa meta etiketi ise her istekte okunuyor. Sonuç,
belgenin önlemek için yazdığı durumun ta kendisi:

| Derleme `SITE_INDEXABLE` yok · çalışma anı `true` | Sonuç                             |
| ------------------------------------------------- | --------------------------------- |
| `robots.txt`                                      | `Disallow: /` — derlemeye gömülü  |
| sayfa meta                                        | `index, follow` — çalışma anından |

**Yön güvenli ama yayın bozuk.** Tarayıcılar `robots.txt`'ye uyup sayfayı hiç
çekmiyor, dolayısıyla "indekslenebilir" diyen meta etiketini de hiç görmüyor:
site kapalı kalıyor, ama açıldığı sanılıyor. Ters yön (açıktan kapalıya) de
güvenli tarafa düşüyor. Yani bu bir güvenlik açığı değil, **sessiz bir yayın
arızası** — ve sessiz olduğu için pahalı.

**Düzeltme:** `robots.ts` `connection()` çağırıyor (Next 16'da dinamik render
işareti; `export const dynamic` kaldırıldı). Route artık her istekte
değerlendiriliyor ve iki çıktı gerçekten tek anahtardan geliyor. Maliyeti
kabul edilebilir: proje zaten CSP nonce'u için tümüyle dinamik render
kullanıyor (§10.2) ve `robots.txt` yanıtı birkaç yüz bayt.

**Doğrulanmış çıktı — tek derleme, iki çalışma anı (ölçüldü):**

```
SITE_INDEXABLE tanımsız →  robots.txt: Disallow: /
                           <meta name="robots" content="noindex, nofollow, nocache">

SITE_INDEXABLE=true    →  robots.txt: Allow: / + Disallow: /api/
                           <meta name="robots" content="index, follow">
```

Aynı derleme çıktısı iki değeri de doğru yansıtıyor; yeniden derleme
gerekmiyor.

**Paylaşım meta verisi.** `metadataBase` olmadan Open Graph alanları göreli kalır ve hiçbir sohbet uygulaması onları çözemez; bağlantı başlıksız gri bir kutu olarak görünür. `SITE_URL` bu tabanı verir.

> **Görsel üretilmiyor.** `twitter:card` bilerek `summary` (görselli `summary_large_image` değil): olmayan bir görseli vaat etmek boş bir kart üretir. Üretilmiş bir paylaşım görseli (`opengraph-image`) istenirse eklenebilir; MVP için gerekli görülmedi.

**Diğer.** 404 sayfası Türkçedir (arayüz dili TR — §1.2) ve denenen adresi **yansıtmaz**: adresi sayfaya basmak, kullanıcı girdisini sayfaya basmanın en kolay yoludur ve buna hiçbir sebep yok (§6.3). Simge, iskeletten kalan Next logosu yerine uygulamanın kendi işaretidir — iki kesişen çember, yani `A ∩ B`.

### 7.12 Tasarım Sistemi

**Neden değişti.** İlk arayüz iki değişken taşıyordu: `--background` ve `--foreground`. Derinlik `opacity` ve `currentColor` saydamlıklarıyla üretiliyordu. Ölçülünce iki sorun çıktı:

1. **Durum bilgisi renksizdi.** Doğru hücre, yanlış hücre, kiralık dönem, puan bandı — hepsi aynı gri tondaydı. Üç oyun modu da tek renkte görünüyordu, yani oyunun geri bildirimi yalnızca metne kalmıştı.
2. **Her saydamlık ayrı bir ölçüm borcuydu.** `/20`, `/50`, `/60`… her biri ayrı bir kontrast oranına karşılık geliyor ve yeni bir değer yazan herkesin tabloya bakması gerekiyordu (§7.10'daki beş ihlal tam olarak böyle oluştu).

**Belirteçler role bağlıdır, tona değil.** `--accent` "yeşil" demek değil, "bu arayüzün vurgu rengi" demek. Bileşenler rolü kullanır; ton değiştiğinde düzeltilecek tek yer `globals.css`. Karanlık mod da bu sayede tek bir medya sorgusuna sığıyor — **hiçbir bileşen `dark:` varyantı taşımıyor.**

| Rol               | Ne için                                | Açık                  | Koyu                  |
| ----------------- | -------------------------------------- | --------------------- | --------------------- |
| `background`      | Sayfa zemini                           | `#f2f4f8`             | `#0d1117`             |
| `surface`         | Kart, panel, açılır liste              | `#ffffff`             | `#151b24`             |
| `surface-2`       | Kart içi ikinci kat (hücre, satır)     | `#e7ebf2`             | `#1d2530`             |
| `foreground`      | Ana metin                              | `#111823`             | `#e7ecf3`             |
| `muted`           | İkincil metin, etiket                  | `#5a6575`             | `#98a3b3`             |
| `line`            | Ayırıcı (süsleme — kontrast şartı yok) | `#d9e0ea`             | `#232c38`             |
| `line-strong`     | Arayüz bileşeni sınırı (girdi, hücre)  | `#7a8595`             | `#6a7788`             |
| `accent`          | Marka, odak konturu, birincil düğme    | `#2b41c4`             | `#7b93ff`             |
| `accent-fg`       | Vurgu dolgusu üzerindeki metin         | `#ffffff`             | `#0a0e15`             |
| `accent-soft`     | Vurgulu zemin (seçili kulüp, seçenek)  | `#e3e8ff`             | `#1a2242`             |
| `correct`/`-soft` | Doğru hücre                            | `#0b6e3f` / `#d9f2e3` | `#4fd98c` / `#0e2a1d` |
| `wrong`/`-soft`   | Yanlış hücre, hata kutusu              | `#b3242f` / `#fbe2e4` | `#ff7a82` / `#301418` |
| `warn`/`-soft`    | Kiralık rozeti, orta puan bandı        | `#7a5200` / `#faedcf` | `#f2b950` / `#2c2011` |
| `note`/`-soft`    | Kesme uyarısı, "kaynakta ayrıntı yok"  | `#6a6153` / `#efebe3` | `#b3a794` / `#23201a` |

**İki ayrı kenarlık rolü, bilinçli.** `line` bir ayırıcıdır ve WCAG 1.4.11 süsleme sınırlarını kapsamaz. `line-strong` bir arayüz bileşeninin sınırıdır ve 3:1'i karşılamak **zorundadır**. Tek değişkende toplansaydı ya ayırıcılar gereksiz koyu olurdu ya da girdi kenarlıkları ölçüsüz kalırdı.

#### Vurgu rengi yeşilden mürekkep mavisine taşındı (10 Ağustos 2026)

**Kusur: `accent` ile `correct` BİREBİR aynı tondu.** İlk palette ikisi de açık modda `#15803d`, koyu modda `#4ade80` idi. Yani ızgarada "doğru bilinmiş hücre" ile "birincil düğme" ayırt edilemiyordu; aynı yeşil aynı anda beş iş yapıyordu — marka, etkin sekme, metin içi sayı vurgusu, birincil eylem ve doğru cevap. Beş işi olan bir renk hiçbirini işaretlemez.

Kusur ölçüm dışıydı: kontrast kapısı her çifti eşiğe karşı denetliyor, ama **iki farklı rolün aynı değeri taşımasını** görmüyordu. Kapı bu yüzden genişletildi (aşağıda).

**Ayrım rol sınırından geçiyor.** `correct`, `wrong` ve `warn` yeşil–kırmızı–amber üçlüsünü zaten sahipleniyor; bunlar **sonucun** dili. `accent` ise **kaydın** dili: seçiciler, gezinme, birincil eylem, odak konturu. Sonuç dilinden çıkmak zorundaydı. Mürekkep mavisi seçildi (`#2b41c4` / `#7b93ff`): üründeki arşiv fikrine bağlanıyor, futbol yeşiliyle çarpışmıyor ve iki temada da eşikleri geniş payla taşıyor.

**Marka tonu ayrı bir dosyadır.** Favicon `#16a34a` yeşilini koruyor; tarayıcı sekmesi sayfanın temasını devralmaz ve simge dosyası kontrast kapısına girmez. Arayüzün vurgu rengi ile sekme simgesinin aynı ton olması bir zorunluluk değildi.

**İki yeni rol eklendi.** `surface-2` kart içindeki ikinci katı taşıyor (`surface` üzerinde `line` ile ayrılan hücreler, saydamlık kullanmadan). `note`, §5.2'nin gerektirdiği dürüstlük metinlerini — kesme uyarısı, "kaynakta ayrıntı yok", kapsam cümlesi — `warn`'dan ayırıyor: bunlar bir uyarı değil, kaynağın sustuğu yere düşülmüş bir kenar notudur ve amber alarm tonuyla söylenmesi olduğundan acil gösteriyordu.

#### Ölçüm

**Otuz bir çiftin tamamı hesaplandı, biri geçemedi ve düzeltildi.** Tasarımın önerdiği koyu mod `line-strong` tonu (`#5a6879`) en açık koyu yüzeyde — `surface-2` — 2,71 veriyordu; arayüz sınırı için 3:1 zorunlu. Ton üç zeminin en darına göre yeniden seçildi (`#6a7788`). Kalan en dar yer açık modda `line-strong` / `surface-2` (3,13).

| Çift                          | Eşik | Açık  | Koyu  |
| ----------------------------- | ---- | ----- | ----- |
| `foreground` / `background`   | 4,5  | 16,18 | 15,94 |
| `foreground` / `surface`      | 4,5  | 17,82 | 14,57 |
| `foreground` / `surface-2`    | 4,5  | 14,90 | 13,01 |
| `foreground` / `accent-soft`  | 4,5  | 14,64 | 13,09 |
| `foreground` / `correct-soft` | 4,5  | 15,07 | 12,94 |
| `foreground` / `wrong-soft`   | 4,5  | 14,51 | 14,28 |
| `muted` / `background`        | 4,5  | 5,37  | 7,41  |
| `muted` / `surface`           | 4,5  | 5,91  | 6,77  |
| `muted` / `surface-2`         | 4,5  | 4,94  | 6,05  |
| `muted` / `accent-soft`       | 4,5  | 4,86  | 6,09  |
| `accent` / `background`       | 4,5  | 7,18  | 6,72  |
| `accent` / `surface`          | 4,5  | 7,91  | 6,14  |
| `accent-fg` / `accent`        | 4,5  | 7,91  | 6,87  |
| `accent` / `accent-soft`      | 4,5  | 6,50  | 5,52  |
| `correct` / `correct-soft`    | 4,5  | 5,36  | 8,51  |
| `wrong` / `wrong-soft`        | 4,5  | 5,33  | 6,75  |
| `wrong` / `surface`           | 4,5  | 6,54  | 6,88  |
| `warn` / `warn-soft`          | 4,5  | 5,96  | 8,95  |
| `note` / `note-soft`          | 4,5  | 5,12  | 6,86  |
| `note` / `background`         | 4,5  | 5,53  | 8,00  |
| `note` / `surface`            | 4,5  | 6,09  | 7,31  |
| `line-strong` / `background`  | 3,0  | 3,40  | 4,15  |
| `line-strong` / `surface`     | 3,0  | 3,74  | 3,79  |
| `line-strong` / `surface-2`   | 3,0  | 3,13  | 3,39  |
| `correct` / `surface`         | 3,0  | 6,33  | 9,58  |

**Kapı bir AYRIKLIK denetimi de yapıyor artık.** Eski hâli yalnızca oranlara bakıyordu ve `accent` ile `correct`'in aynı hex olmasını görmedi (yukarıdaki kusur). Test şimdi ayrıca **anlamı çakışan rol çiftlerinin farklı değer taşıdığını** doğruluyor: bir rol başka bir rolün tonunu aynen alırsa, o iki rolü ayırmak için yazılmış bütün arayüz sessizce tek renge düşer ve oran denetimi bunu hiçbir zaman yakalamaz.

**Ölçüm bir KAPIDIR, bir kerelik denetim değil** — `tests/unit/app/contrast.test.ts`. Test `globals.css`'i okuyup belirteçleri ayrıştırıyor ve yukarıdaki çiftlerin tamamını her iki modda hesaplıyor. Değerler testin içine kopyalanmadı ve bu bilinçli: iki kaynak olsaydı asıl kaçırmak istediğimiz durumu — CSS'te değişip testte değişmeyen bir ton — hiç yakalayamazdı.

> Denetimin kendisi de test ediliyor: siyah/beyaz için tam 21:1 beklendiği doğrulanıyor ve elenmiş bir tonun (`#16a34a` beyaz üzerine) eşiğin altında kaldığı gösteriliyor. Ayrıca bozuk bir belirteçle koşturulup **kırmızıya döndüğü** ölçüldü — `--muted` açık modda `#b9c3bf` yapıldığında üç çift birden düşüyor (1,68 / 1,81 / 1,73).

**Bu testin kapsamadığı şey — dürüstçe:** belirteçlerin ORANLARINI doğruluyor, hangi bileşenin hangi belirteci kullandığını değil. `text-muted` yazılması gereken yere `text-line` yazılırsa bu test görmez; onu ancak gerçek tarayıcıda bir denetim yakalar (Faz 4.5).

#### Odak göstergesi

Odak `ring` ile değil **`outline`** ile veriliyor: `outline` elemanın dışına çizilir ve üzerinde durduğu zeminden bağımsızdır. `ring` iç gölge olduğu için her kapsayıcıda ayrı bir `ring-offset` rengi ayarlamayı gerektiriyordu. Renk tam güçte `accent` — saydamlaştırılmış bir halka ölçümü yeniden açardı.

Düğme ve bağlantılarda `focus-visible`, girdi kutularında `focus` kullanılıyor. Ayrım kasıtlı: girdi kutusunda odak her zaman görünmeli (fareyle tıklayan kullanıcı da metin imlecinin nerede olduğunu bilmeli), düğmede yalnızca klavye gezinmesinde.

#### Hareket

Geçişler (`transition-colors`) süslemedir. `prefers-reduced-motion: reduce` seçen kullanıcı için `globals.css`'te **genel olarak** kapatılıyor; karar tek tek bileşenlere bırakılsaydı eklenen ilk yeni geçişte unutulurdu (WCAG 2.3.3).

#### Başlık düzende, altbilgi sayfalarda

`SiteHeader` `layout.tsx`'e taşındı: aynı gezinme üç sayfada birebir tekrarlanıyordu ve her sayfa bulunduğu modu elle bildiriyordu. Artık yol adresinden türetiliyor ve 404 ile hata ekranı da gezinmeye kavuşuyor.

`SiteFooter` **taşınmadı ve bu bilinçli.** Altbilgi veri kümesinin tarihini gösteriyor, yani veritabanına gidiyor. Düzene konsaydı hata sayfası da o sorguya bağımlı olurdu ve veritabanı bozulduğunda hata ekranının kendisi çökerdi — kullanıcıya gösterilecek son sayfa tam da o an kaybolurdu.

### 7.13 Kulüp İşareti (BR-35)

Kulüp adının yanındaki işaret **sabit ölçülü bir yuvadır** ve hep doludur:

| Durum                     | İçerik                          |
| ------------------------- | ------------------------------- |
| Lisanslı arma var (%43,7) | Arma                            |
| Arma yok (%56,3)          | Kulüp adından türetilen üç harf |

Önceki davranış "arma yoksa boş kare" idi. Hizalama doğruydu ama sonucu, listelerin yaklaşık yarısının delik görünmesiydi — ve delikler rastgele dağılmıyor: Manchester United, Arsenal, Everton boş kalırken küçük kulüpler dolu görünüyordu (§4.3.1). **Tutarsızlık, yokluktan kötü görünür.**

#### Forma rengi denendi ve ÖLÇÜMLE ELENDİ

Doğal fikir, kulüp renklerini kullanmaktı: bilgi kutuları forma renklerini onaltılık kod olarak taşıyor, renk bir olgudur ve telif yüzeyi yoktur. Ham kapsam da armadan çok yüksek çıktı (%93,0). **Fikir yine de kullanılamaz** — ölçüm (2026-08-09, önbellekteki 791 kulüp makalesi):

| Bulgu                                    |    Sayı |       Pay |
| ---------------------------------------- | ------: | --------: |
| `body1` onaltılık olan                   |     674 |         — |
| bunların **desen katmanı olan**          | **598** | **%88,7** |
| desenli **ve** beyaz tabanlı (şüpheli)   |     160 |     %23,7 |
| desensiz — düz okumanın güvenilir olduğu |      76 |     %11,3 |

`pattern_b1`, formanın üzerine çizilen ayrı bir görselin adıdır (`_galatasaray2627h`) ve renkleri okunamaz. Bu durumda `body1` tasarımın **tabanıdır**, kimliği değil. Doğrulandı:

```
Galatasaray  body1 = 270e8b   (lacivert)  — kulüp sarı-kırmızı
Genoa        body1 = FFFFFF   (beyaz)     — kulüp kırmızı-lacivert
Barcelona    body1 = 05003B   (koyu mavi) — kulüp blaugrana
Juventus     body1 = YOK                  — kimlik tamamen desende
```

Arıza yönü ters: **makale ne kadar iyi bakımlıysa forma o kadar özel desenle çizilir**, yani en tanınmış kulüplerde en çok yanılır. Beyaz taban süzgeci Genoa'yı yakalar, Galatasaray'ı ve Barcelona'yı yakalamaz; ayırt edici başka bir işaret yok.

Wikidata'nın renk ifadesi (`P462`) alternatif olarak ölçüldü: 906 seçilebilir kulübün **13'ünde** var (%1,4). Yol değil.

Sonuç: kulüp rengi için güvenilir bir kaynak YOK. Baş harf, uydurulmuş bir renkten iyidir — yanlış renk, yanlış arma ile aynı sınıfta bir hatadır (§2.7).

#### Baş harfler

Addan türetilir, saklanmaz. Kural: kulüp türü kısaltmaları (`FC`, `SK`, `AC`…), sıra numaraları ve parantezli ekler atılır; kalandan **üç harf** üretilir.

##### İki harften üç harfe (10 Ağustos 2026)

**Ölçüm önce yapıldı.** İşaret yalnızca armasız 510 kulüpte basılıyor — armalı kulüpte karo yerine arma çizilir, yani orada çakışma görünmez. O 510 kulüp iki harfle şöyle dağılıyordu:

```
BR  8  Brentford, Blackburn Rovers, Brescia, SC Braga, Brøndby IF, Brommapojkarna …
AC  7  A.C. Carpi, A.C. Savoia, Academica Clinceni, Angoulême Charente …
HA  7  Hatayspor, Hamilton Academical, Halmstads, Hammarby IF, Haugesund …
```

**Armasız kulüplerin %68,6'sı (350'si) işaretini en az bir başka kulüple paylaşıyordu.** İşaret bir ayırt edici değil, bir doku hâline gelmişti: kulüp seçicide art arda gelen üç `BR` karosu hangisinin Braga hangisinin Brescia olduğunu söylemiyor.

**Neden önce iki harfti ve neden dayanağı düştü.** Gerekçe ölçüydü: işaret 20 px basılıyordu ve üç harf o boyutta okunmuyordu. Yeni tasarımda karo **26 px**; dayanak geçerliliğini yitirdi, kural da onunla birlikte değişti. Karo küçültülürse bu kararın yeniden ölçülmesi gerekir — üç harf 20 px'te hâlâ okunmaz.

**Dört varyant ölçüldü, en az çakışan seçildi:**

| Varyant                                               | Çakışan kulüp |       Pay |
| ----------------------------------------------------- | ------------: | --------: |
| Bugünkü — iki harf                                    |           350 |     %68,6 |
| Üç harf, çok sözcüklüde her sözcükten bir             |           139 |     %27,3 |
| Üstüne noktalı kısaltma birleştirme (`A.C.` → `AC`)   |           144 |     %28,2 |
| **Hep üç karakter: iki sözcüklüde ilk sözcükten iki** |        **74** | **%14,5** |

Seçilen varyant çakışmayı **%68,6'dan %14,5'e** düşürüyor. İki sözcüklü adlarda her sözcükten bir harf almak (`Athletic Bilbao` → `AB`) sorunun büyük kısmını çözmüyordu; `Swansea City` ve `Stoke City` ikisi de `SC` kalıyordu. İlk sözcükten iki harf almak ikisini `SWC` / `STC` yapıyor.

**Noktalı kısaltmalar birleştiriliyor.** `A.C. Carpi` ayrıştırıcıda `A` + `C` + `Carpi` olarak üç sözcüğe bölünüyordu; ne `A` ne `C` tür listesinde olduğu için ikisi de ayırt edici sayılıyor ve sonuç `ACC` çıkıyordu. Nokta dizileri artık ayrıştırmadan önce birleştiriliyor (`A.C.` → `AC`), böylece tür listesi işini görüyor: `A.C. Carpi` → `CAR`, `A.C. Savoia` → `SAV`. Toplam çakışmayı 5 kulüp artırıyor ama **ürettiği işaret doğru**; toplamı iyileştirmek için yanlış işaret üretmek takas değil, gerileme.

**Küresel çakışma çözümü BİLEREK yapılmadı.** Tasarım "aynı karo iki kulübe düşerse harf sayısını artır" öneriyordu. Bu, saf bir fonksiyonun bilemeyeceği bir şey ister: bütün kulüp listesi. Uygulanabilmesi için işaretin ya ETL'de veriye yazılması (yeni alan, göç ve tazeleme yükümlülüğü — §7.13'ün baştaki "veri değil türetme" kararının tersi) ya da her render'da listenin tamamının dolaşılması gerekirdi. Kalan %14,5 için ikisi de ağır. İşaret zaten `aria-hidden` ve **kulüp adı her zaman yanında yazılı** — karo bir ayırt edici yardımcıdır, tek tanıtıcı değil.

Büyük harfe çevirme kuralı **kulübün ülkesine bağlıdır** ve bu, ölçümle bulunmuş bir tuzaktır.

`"i".toUpperCase()` JavaScript'te `"I"` verir, `"İ"` değil — Türkçe için yanlış. İlk yazımda düzeltme topyekûn uygulandı (`toLocaleUpperCase("tr")`) ve test bunu anında çürüttü: **`AC Milan` işareti `Mİ` çıktı.** Kural, düzeltmeyi hak eden 41 Türk kulübü için doğruyken kalan 865 kulübü bozuyordu.

Ayrım `country` alanına bakılarak yapılır — doğru cevabı taşıyan tek alan o:

```
Sivasspor   (TR) → Sİ      AC Milan  (IT) → MI
İstanbulspor(TR) → İS      Everton   (GB) → EV
```

`İstanbulspor`'un ilk harfi kaynakta zaten `İ` olduğu için tek başına sorun çıkarmıyordu; kural asıl **tek sözcüklü adların ikinci harfinde** iş görüyor.

İşaret `aria-hidden`: yanındaki kulüp adının görsel tekrarıdır, yeni bilgi taşımaz (WCAG 1.1.1, arma ile aynı gerekçe).

### 7.14 Kulüp Seçici: iki kademeli gözat (BR-37)

Ad yazarak arama 906 kulübün adını **bilen** kullanıcı için çalışır. Bilmeyen için çalışmaz: "Hollanda'da hangi takımlar var" sorusunun arama kutusunda karşılığı yok. Seçici bu yüzden iki kademelidir.

**Kademe 1 — arama kutusu boşken lig listesi.** 24 lig, kulüp sayılarıyla. Kullanıcı yazmaya başladığında liste kendiliğinden **bütün kulüplarda arama** sonucuna döner; yani bugünkü davranış aynen korunur ve lig listesi yalnızca boş kutuda görünür.

**Kademe 2 — bir lig seçilince o ligin kulüpleri.** Yazmak artık **ligin içinde** arar. Geri dönüş `Escape` ile ya da başlıktaki "‹" ile olur.

**`Escape` iki anlam taşır ve sırası önemlidir:** kademe 2'de **geri**, kademe 1'de **kapat**. Tek tuşla doğrudan kapanmak, ligin içine girmiş kullanıcıyı tek yanlış tuşta en başa atardı; kademeli geri alma, gezinmenin tersine çevrilebilir olmasıdır.

**ODAK KURALI DEĞİŞMEDİ (§7.13 ile aynı gerekçe).** Klavye odağı her iki kademede de metin kutusunda kalır; hem lig hem kulüp listesi `role="listbox"` + `role="option"` olduğu için `aria-activedescendant` ve ok tuşları tek bir kodla iki kademede de çalışır. Geri düğmesi `tabIndex={-1}` taşır ve `onMouseDown` ile çalışır — odağı kutudan almaz.

**Kademe değişimi DUYURULUR.** Görsel olarak liste değişiyor ama ekran okuyucu için bu sessiz bir olaydır; `aria-live="polite"` bir durum satırı hangi kademede olunduğunu ve kaç sonuç bulunduğunu söyler.

#### Listeden ÇIKIŞ yolu birden fazladır

İlk sürümde liste yalnızca `Escape` ile ya da bir kulüp seçilerek kapanıyordu; **dışarı tıklamak kapatmıyordu**. Kullanılırken bulundu ve bu bir kusurdur: açılır listenin dışına tıklamak, her açılır listede "vazgeçtim" demektir ve karşılık vermeyen arayüz kilitlenmiş gibi görünür.

Üç çıkış yolu vardır ve **anlamları farklıdır**:

| Yol                   | Ne yapar                                    | Kime lazım                     |
| --------------------- | ------------------------------------------- | ------------------------------ |
| Dışarı tıklama (blur) | Listeyi kapatır, **yazılanı korur**         | Fare kullanıcısı               |
| `Escape`              | Kademe 2'de geri, kademe 1'de kapatır       | Klavye kullanıcısı             |
| **Vazgeç** düğmesi    | Kapatır, yazılanı **ve** lig seçimini siler | Dokunmatik — `Escape` tuşu yok |

**Yazılanın korunup korunmaması bilinçli bir ayrımdır.** Yanlışlıkla dışarı tıklayan kullanıcı yazdığını kaybetmemeli; "Vazgeç" diyen kullanıcı ise açıkça baştan başlamak istiyor. Aynı davranışı ikisine de vermek, birinde veri kaybı öteki tarafta ise yarım kalmış bir durum üretirdi.

**Vazgeç düğmesi odağı ALMAZ.** Diğer açılır liste öğeleriyle aynı kural: `tabIndex={-1}` ve `onMouseDown` + `preventDefault`, çünkü odak metin kutusundan çıkarsa `blur` tetiklenir ve düğme kendi tıklamasından önce listeyi kapatırdı.

Açılır listenin kendisi de `mousedown`'da `preventDefault` uygular: kaydırma çubuğuna ya da boşluğa tıklamak listeyi kapatmamalı — kullanıcı orada bir şeyi kapatmayı değil, listede gezinmeyi amaçlıyor.

#### Kesme SESSİZ olamaz

Üst sınır `MAX_CLUB_RESULTS = 50` (§7.1) ve **bu sınır lig süzgecinde de korunur**. Ama ölçüldü: Serie A'da 83, Bundesliga'da 59, La Liga'da 58 seçilebilir kulüp var. Yani büyük liglerde liste **kesilir**.

Kesildiğini söylememek bir kusur olurdu: kullanıcı ligin tamamını gördüğünü sanır ve aradığı kulübü "veri kümesinde yok" diye okur — §1.3'ün kapsam uyarısıyla aynı hata sınıfı. Liste kesildiğinde sayı açıkça yazılır:

> _83 kulüpten 50'si gösteriliyor — daraltmak için yazın._

Sınırı yükseltmek yerine bunun seçilmesi bilinçlidir: sınır bir kaynak koruması, kesme bildirimi ise bir dürüstlük koşuludur; ikisi çelişmiyor.

#### Kesme uyarısı KAYAN ALANIN DIŞINDA (10 Ağustos 2026)

İlk uygulamada açılır kutunun tamamı tek bir `overflow-auto` alanıydı ve uyarı listenin son düğümüydü. Sonuç: Serie A'da uyarıyı görmek için **elli satır kaydırmak** gerekiyordu — yani tam da listenin eksik olduğunu bilmeden sonuna kadar inmek. Kural kâğıt üzerinde sağlanıyor, ekranda sağlanmıyordu.

Kutu üç bölgeye ayrıldı: **sabit başlık** (nerede olunduğu + çıkış), **kayan liste**, **sabit dip** (kesme uyarısı). Uyarı `note` rolünü taşıyor — alarm değil, kaynağın sınırına düşülmüş bir not (§7.12).

Başlık şeridi ayrıca kademeyi yazıyor: kademe 1'de kapsam (`24 lig · 906 kulüp`), kademe 2'de kırıntı yolu (`Bütün ligler / Serie A`) ve geri dönüş hedefi. **"Vazgeç" da buraya taşındı**; dip artık uyarının yeri ve ikisi alt alta dizilseydi asıl söylenmesi gereken şey bir düğmenin altında kalırdı.

Arama ipucu da kademeye bağlandı. Sabit `Kulüp arayın…` metni, kutu lig listesi gösterirken yanlış bilgi veriyordu: kullanıcı kulüp adı yazmasının beklendiğini sanıp lig satırlarını atlıyordu. İpucu artık `Lig seçin ya da yazın…` / `Serie A içinde arayın…` biçiminde değişiyor.

Değişiklik bir testle tutuluyor: uyarının kayan alanın **dışında** olduğu doğrulanıyor. Yalnızca metnin varlığını sınayan bir test bu kusuru hiç görmezdi — metin zaten vardı.

---

### 7.15 Mod Künyesi ve Skor Tabelası

Dört mod dört ayrı `<header>` yazıyordu ve üçü birbirinin kopyasıydı: aynı `text-3xl` başlık, aynı `mt-3 text-lg text-muted` açıklama. Kopya olduğu için de **ayrışmıştı** — biri `max-w-prose` taşıyor, diğeri taşımıyordu.

`ModeHeader` bu bandı tek yerde topluyor: üst etiket (`Mod 1 · Kesişim`), modun adı (sayfanın tek `h1`'i), görev cümlesi ve isteğe bağlı tabela.

#### Başlık küçüldü, sayı büyüdü

Önceki düzende en büyük tipografi sayfa başlığındaydı — yani **gezinme çubuğunda zaten yazan sözcüğün tekrarında.** Oysa bu üründe her ekran bir sayıya bakıyor: `55 ortak oyuncu`, `2/9`, `%62`, `Seri 7`, `1993–2002`, `240 maç`. Ölçek onlara verildi: başlık 26 pt, tabeladaki canlı sayı 30 pt.

#### Tabela CANLI, statik bir künye değil

Ortak oyuncu modunda tabela boş durumda veri kümesinin büyüklüğünü taşıyor (`Kulüp 906 · Lig 24 · Oyuncu 132.263`), sonuç geldiğinde sonucun kendisine geçiyor (`Ortak oyuncu 55 · Dönem 147`) ve **vurgulanıyor**. Aynı yer, aynı bileşen: kullanıcı sayının nereye yazılacağını bir kez öğreniyor.

Vurgu (`lit`) bir süsleme değil: bugünkü arayüzün en çok eleştirilen yanı, sonucun sessizce belirmesiydi. Boş tabela ile dolu tabela aynı görünemez.

Bu yüzden künye **sunucu sayfasında değil, mod bileşeninin içinde** duruyor. Sunucuda render edilen sabit bir başlık canlı sayıyı taşıyamazdı; ikinci bir sayaç eklemek ise aynı sayıyı iki yerde göstermek olurdu.

**Gösterecek gerçek sayısı olmayan mod tabela taşımaz.** Boş ya da uydurma bir sayaç, sayacın kendisini anlamsızlaştırır. Düello modunun kurulum evresinde tabela basılmıyor: henüz sayılacak bir şey yok.

#### Dört modun tabelası

| Mod            | Boş durum                     | Canlı                          | Vurgu (`lit`)         |
| -------------- | ----------------------------- | ------------------------------ | --------------------- |
| Ortak Oyuncu   | `Kulüp · Lig · Oyuncu`        | `Ortak oyuncu · Dönem`         | Sonuç boş değilse     |
| Günün Izgarası | `Doğru 0/9 · Hak 9`           | aynı hücreler, sayılar akar    | Oyun bittiğinde       |
| Günün Oyuncusu | `Cevaplanan 0/6 · Ortalama —` | `Cevaplanan n/6 · Ortalama %n` | Tur tamamlanınca      |
| Hangisi Daha   | tabela yok (kurulum)          | `Seri n`                       | Seri sıfırdan büyükse |

Renk **sonuç dilinden** geliyor (§7.12): ızgarada doğru hücre sayısı `correct`, kalan hak azaldıkça `warn` ve bittiğinde `wrong`; istatistikte ortalama BR-18'in puan bandına göre. Hepsinde renk yalnızca destekleyici — sayı zaten yazılı (WCAG 1.4.1).

**Sayaçlar `aria-live` içinde kaldı.** Künyeye taşınmak, sayının değişmesini yalnızca görsel bir olaya çevirmemeli; her modda tabelayı saran bir `aria-live="polite"` var.

#### Künye oyun bileşeninin İÇİNDE, sayfada değil

Dört modun üçünde sayaçlar istemci bileşeninin durumundan geliyor (ızgara ilerlemesi, cevaplanan istatistik sayısı, seri). Künyeyi sunucu sayfasında bırakıp sayıyı yukarı taşımak, **aynı sayının iki yerde yaşaması** demekti — ve senkronu bozulduğunda hiçbir test bunu yakalamazdı.

Bunun bir yan koşulu var: ızgara ve istatistik modlarında **aynı oyun bileşeni iki kez** kullanılıyor (günlük tur + "Sen kur" / "Sen seç"). Künye bu yüzden isteğe bağlı bir `header` prop'una bağlı; ikinci örnek onu almaz, çünkü sayfada ikinci bir `h1` olamaz. O turlar kendi satır içi sayaçlarını koruyor.

#### Tarih biçimlendirici tek kaynağa indi

Aynı `Intl.DateTimeFormat` üç yerde ayrı ayrı yazılmıştı (altbilgi, ızgara sayfası, istatistik sayfası) ve üçü de aynı gerekçeyi yorum olarak tekrarlıyordu. Künye tarihleri istemci bileşenlerine taşınınca dördüncü bir kopya gerekecekti; bunun yerine `src/lib/format-date.ts` açıldı.

Zaman dilimi **UTC'ye sabit** ve bu bir tercih değil doğruluk koşulu: `new Date("2026-07-31")` UTC gece yarısı olarak ayrıştırılır, biçimlendirme sabitlenmezse gün hassasiyetindeki bir tarih kullanıcıya **bir gün öncesi** olarak görünebilir. Günlük ızgara ve günün oyuncusu tam olarak bu hassasiyette çalışıyor. Üç kopya, üçünün ayrışması demekti — birinde `timeZone` unutulsa kimse fark etmezdi.

#### `countPlayers` — künye port'una eklendi

Tabeladaki oyuncu sayısı `DatasetRepository.countPlayers()`'tan geliyor; `countSelectableClubs` ile aynı cinsten bir olgu ve aynı gerekçeyle veriden okunuyor: elle yazılan bir kapsam sayısı, kapsam genişlediği anda sessizce yalan söylemeye başlar ve bunu kimse fark etmez (§5.2'de bir kez ölçülmüştü: sayfada `345 kulüp` yazıyordu).

**Süzgeç yok, bilinçli.** Kulüplerde `isSelectable` var çünkü kullanıcı onları bir listeden **seçiyor**; oyuncuda böyle bir kavram yok — her oyuncu bir sonuçta görünebilir. Buraya bir süzgeç eklemek, tabeladaki sayı ile sonuçlarda karşılaşılabilecek oyuncu kümesini ayırırdı.

#### Kapsam bandı artık VERİDEN geliyor

Kapsam bildirimi (§1.3) yirmi dört ligin adını **düzyazı içinde elle sayıyordu** — kapsam genişlediği gün sessizce eskiyecek bir liste, yani `345 kulüp` ile aynı sınıftan bir kusur. Metin kısaltıldı ve lig listesi, seçicinin zaten kullandığı `listLeagues()` çıktısından üretilen ülke kodu etiketlerine dönüştü. Tek kaynak veri.

### 7.16 Sonuç Defteri

Ortak oyuncu sonucu bir arama çıktısı gibi görünüyordu; oysa gösterdiği şey bir **kayıt dökümü**. Düzen buna göre değişti: sabit sütun başlığı, cetvelli satırlar, dönem hücreleri.

#### Kulüp adı 110 kez basılıyordu

Önceki düzende her oyuncu satırı iki kulübün adını kendi içinde tekrarlıyordu. 55 oyunculuk bir sonuçta bu, aynı iki adın **110 kez** basılması demek — ve o tekrar hiçbir bilgi taşımıyor, çünkü sütun boyunca değişmiyor. Adlar defterin başlığına çıktı, sütun başına bir kez.

**Ama ad SİLİNMEDİ, GİZLENDİ — ve gizleme yolu `display:none` DEĞİL.** Hücre etiketi geniş ekranda `sr-only` oluyor. Fark can alıcı: `display:none` yardımcı teknolojiden de gizler ve ekran okuyucu kullanıcısı "1993 – 2002, 240 maç" satırını hangi kulübe ait olduğunu bilmeden okurdu. Izgara başlığı ile hücre arasında **programatik bir bağ yok** — CSS ızgarası bir tablo değildir, `scope` taşımaz. Başlığın kendisi bu yüzden `aria-hidden`: adlar zaten her hücrede yazılı, gizlenmeseydi ekran okuyucu ikisini de iki kez duyururdu.

Bir test bu bağı koruyor: satırın içinde iki kulübün adı da **okunabilir** olmalı. `sm:hidden`'a dönen bir "sadeleştirme" orada kırmızıya döner.

#### Dar ekranda başlık yok, etiket var

Üç sütun 390 px'e sığmıyor ve satırlar zaten alt alta yığılıyor; başlık orada basılmıyor (`hidden sm:grid`) ve kulüp adı her hücrenin kendi etiketinde görünür kalıyor. Bilgi iki düzende de tam — değişen yalnızca yeri.

#### Dönem rozeti üç durumu SOL KENARDA ayırıyor

| Durum    | Kenar                    | Zemin       | Metin                  |
| -------- | ------------------------ | ----------- | ---------------------- |
| Normal   | `line-strong` (sol 2 px) | `surface-2` | yıl aralığı + maç      |
| Kiralık  | `warn` (sol 2 px)        | `warn-soft` | + "kiralık" sözcüğü    |
| Kanıtsız | `note`, kesik            | `note-soft` | "kaynakta ayrıntı yok" |

Renk hiçbirinde tek gösterge değil (WCAG 1.4.1): kiralıkta sözcük, kanıtsızda hem metin hem kesik çizgi var. BR-3 ve BR-8'in metin koşulları olduğu gibi duruyor.

---

## 8. Kalite Güvencesi

### 8.1 Test Piramidi

| Seviye      | Kapsam                                                          | Araç            |
| ----------- | --------------------------------------------------------------- | --------------- |
| Birim       | `domain/` iş kuralları (BR-1…BR-6), use-case'ler, normalizasyon | Vitest          |
| Bileşen     | ARIA sözleşmesi, klavye gezinme, durum akışı                    | Vitest + RTL    |
| Entegrasyon | Repository'ler, gerçek şema ile geçici SQLite dosyası           | Vitest + Prisma |
| Sözleşme    | API route'ları: geçerli/geçersiz girdi, hata biçimi, limitler   | Vitest          |
| Doğruluk    | Elle doğrulanmış olgu seti (`tests/fixtures/golden-pairs.ts`)   | Vitest          |

Bileşen testleri jsdom ortamını dosya başındaki `@vitest-environment jsdom` yorumuyla açar; varsayılan ortam Node'dur ve testlerin çoğuna jsdom maliyeti bindirilmez.

Sözleşme testleri route handler'ları **gerçekten** çağırır: `next/server` isteği, gerçek Zod şeması, gerçek Prisma deposu, gerçek hız sınırlayıcı. Sarmalayıcıyı taklit eden bir test, uçların §6'ya uyduğunu söyleyemezdi.

**Kapsam eşiği:** `domain/` ve `application/` için satır kapsamı ≥ %85. UI bileşenleri için eşik yok.

#### Her seviyenin cevapladığı soru farklıdır

Üç seviye üst üste binen değil, **birbirini tamamlayan** sorular sorar. Karıştırılırsa biri diğerinin yerine geçmiş sayılır ve arada boşluk kalır:

- **Birim** — kural doğru mu _yazılmış_? Sahte port'larla çalışır, milisaniye sürer. Veritabanı sorgusunun doğruluğu hakkında hiçbir şey söylemez.
- **Entegrasyon** — kural SQL'e doğru mu _çevrilmiş_? `spellQualifies` bir kez TypeScript'te, bir kez `WHERE` olarak yazılı; test filtresiz satırları çekip domain yüklemini bellekte uygular ve iki sonucun aynı olmasını bekler. Verinin kendisi hakkında bir şey söylemez.
- **Doğruluk** — sonuç gerçekten _doğru mu_? Gerçek veri kümesine bakar.

#### Altın veri seti

`tests/fixtures/golden-pairs.ts` iki farklı şey tutar ve ayrım kasıtlıdır:

1. **Elle doğrulanmış olgular (31 kayıt, 27 kulüp çifti)** — "şu oyuncu şu iki kulüpte de oynadı". Kaynağı genel futbol bilgisidir, veritabanı değil; veritabanından türetilmiş bir "altın" set yalnızca kendini doğrular. **Çağrıyı** (recall) ölçer.
2. **Dondurulmuş sayımlar (6 çift)** — o günkü sonuç. Doğruluk iddiası taşımaz, yalnızca **gerileme** yakalar; ETL yeniden koştuğunda sayılar oynayacağı için eşleşme %15 toleranslıdır.

Kimlikler kulüp ve oyuncu için **QID ile** sabitlenir. Gerekçe ölçülmüştür: `name contains "Shevchenko"` hiçbir şey bulmuyor, çünkü kayıt Türkçe etiketiyle "Andriy Şevçenko" olarak duruyor. Ad bir gösterim ayrıntısıdır; dile, alfabeye ve düzenlemeye göre değişir.

Bu testler veritabanı yoksa **atlanır** (ETL çıktısı depoya girmez). Sessizce geçmezler — "çalıştı" ile "çalışmadı ama ses çıkarmadı" karıştırılmamalıdır.

### 8.2 Veri Doğruluğu Denetimleri

Denetim **iki aşamalıdır**. Tek aşamalı ilk tasarım kullanılamaz çıktı: 78.236 kaydın 11'i bozuk olduğu için tüm yükleme durmuştu. Kaynak açık veriyse birkaç hatalı kayıt kaçınılmazdır; anlamlı sinyal tek kaydın bozukluğu değil, bozukluk **oranıdır**.

1. **Ayıklama** (`sanitizeSpells`) — kendi içinde çelişen tekil kayıtlar atılır:
   - `startYear > endYear` olan kayıt,
   - yıl aralığı `[1850, bugünkü yıl + 1]` dışında olan kayıt.
2. **Oran denetimi** (`validateDataset`) — ayıklama oranı `MAX_REJECT_RATIO` (%1) eşiğini aşarsa süreç **hata ile biter** ve veritabanı güncellenmez. Örtüşen kalıcı dönem, kuruluş yılından önceki dönem ve 50'den az dönem gelen kulüp **uyarı** üretir; bunlar kaynaktaki bilinen gürültüdür (kulüp kuruluş yılı sık sık selef kulübü gösterir) ve yüklemeyi durdurmaz.

Yükleme ayrıca **otoriter**dir: tam koşuda gelen listede olmayan kulüpler, dönemi kalmayan kulüpler ve dönemi kalmayan oyuncular silinir. Bu olmadan veritabanı önceki koşuların artıklarını biriktiriyordu.

#### Kapsam boşlukları — ikinci KAYNAK, elle düzeltme değil

Wikidata'da **hiç olmayan** dönemler var. Boşluk ölçüldü (2026-07-31) — güncel kadronun veri kümesinde bulunma oranı:

| Kulüp       | Kapsam    |
| ----------- | --------- |
| Real Madrid | 24/24     |
| Arsenal     | 23/24     |
| Galatasaray | **13/24** |
| Beşiktaş    | **10/22** |
| Trabzonspor | **5/15**  |

Boşluk **kaynaktadır, bizde değil**. Abdülkerim Bardakçı'nın (`Q318069`) yedi `P54` kaydı var; hiçbiri Galatasaray değil. Alternatif bir Galatasaray ögesi de yok — eksik oyuncuların tamamının kulüp bağları tek tek okundu. Boru hattının kayıpsızlığının kanıtı: Galatasaray ∩ Konyaspor **bizde 30, Wikidata'da 30**.

Neden önemli: ızgara cevabı `matchesAll` ile veri kümesine bakarak doğrular (BR-12). Eksik dönem listeyi kısaltmakla kalmaz — **doğru cevabı yanlış saydırır**.

**ELLE DÜZELTME DENENDİ VE KALDIRILDI.** Boşluk ilk fark edildiğinde `scripts/etl/overrides/` altında elle tanımlanan 49 dönemlik bir mekanizma yazıldı: kaynak zorunluluğu, üzerine yazmama kuralı, kendini iptal etme, `db:verify` denetimi. Çalışıyordu ama **yanlış problemi çözüyordu.**

Kusuru ölçekte: veri kümesi yılda iki kez tazeleniyor ve her tazelemede birinin oturup yeni boşlukları bulup elle yazması gerekiyordu. Kendini güncelleyebilen bir sistem, insan emeğine bağımlı bir adım barındıramaz — o adım er geç atlanır ve veri sessizce eskir. Mekanizma **tamamen silindi** (kod, veri dosyası, testler).

**Boşluklar ikinci bir KAYNAKLA kapatılır** (§4.3). Ölçüldü: elle yazılan 49 kaydın **45'i** (%92) Türkçe Vikipedi bilgi kutusunda zaten duruyor — üstelik bizim yazdığımızdan zengin. Bardakçı örneği: elle kayıtta yıl bile yoktu, Vikipedi `2022-`, `119 maç`, `10 gol` diyor.

Kalan 4 kayıt (Karbownik, Skov Olsen, Umut Bozok → Başakşehir; Kutucu → Rizespor) hiçbir kaynakta yok; hepsi 2026 yaz dönemi transferi. Bunlar **bilerek kaybedildi**: kaynak güncellendiğinde kendiliğinden geri gelecekler, kimsenin elle girmesi gerekmeyecek. Bir kaydın altı ay geç gelmesi, sistemin her altı ayda bir insan gerektirmesinden iyidir.

#### Yükleme sonrası kabul kontrolü — `npm run db:verify`

Denetimler ETL'in kendi çıktısına bakar; kabul kontrolü ise **veritabanına** bakar ve sorular sorar: zorunlu kulüpler seçilebilir mi, boş kulüp/öksüz oyuncu kaldı mı, bilinen kulüp çiftleri ortak oyuncu döndürüyor mu. Kulüp evreni sorgularına (§5.3) her dokunuşta çalıştırılır; hatalı çıkışla biter.

Zorunlu kulüp listesi keyfi değil: her satır bir kez bozulmuş bir kulüptür ve orada aynı hatanın sessizce geri gelmesini engellemek için durur.

#### Kanıtsız dönem oranı (BR-8)

Kanıtsız dönemler elenmiyor, etiketleniyor (§1.4). Etiketlemenin dürüst kalması oranın **izlenmesine** bağlıdır: oran sessizce büyürse arayüzdeki uyarı bir istisnayı değil çoğunluğu tarif etmeye başlar ve anlamını yitirir. Bu yüzden `db:verify`, kanıtsız dönem oranını ölçer ve tavanı aşarsa hatalı çıkar. Ölçülen değer: **%11,7** (193.003'ün 22.520'si).

Bu, ETL'i durduran bir kapı olduğu için tavan gerçekçi bir tamponla konur — amaç mevcut gürültüyü cezalandırmak değil, **kötüleşmeyi** yakalamaktır.

### 8.3 CI Ardışık Düzeni

**Kod (her push).** `npm run verify` → `typecheck` → `lint` → `format:check` → `test` → `build`, ardından `npm run audit:ci`. Herhangi biri başarısızsa birleştirme (merge) engellenir.

**Veri (zamanlanmış).** Yılda iki kez — transfer dönemleri kapandıktan **birkaç hafta sonra** — ve elle tetiklenebilir. Sıra: `etl` → `db:verify` → yayımla → dağıt. `db:verify` kapıdır: geçmezse dağıtım oluşmaz ve site bir önceki veriyle çalışmaya devam eder (§3.1).

> **Neden pencere kapanır kapanmaz değil.** Kaynak Wikidata'dır ve gönüllü katkısıyla güncellenir. Transferin sisteme yansıması, o transferin Wikidata'ya girilmiş olmasına bağlıdır; büyük kulüplerde bu günler sürer, küçüklerde daha uzun. Pencere kapanır kapanmaz koşmak, eksik bir anlık görüntüyü altı ay boyunca yayında tutmak demektir.

---

## 9. Genişletilebilirlik: Oyun Modları

MVP tek mod içerir, fakat sözleşme baştan tanımlanır. Yeni bir mod eklemek `application/game-modes/` altına bir dosya koyup kayıt listesine eklemekten ibaret olmalıdır — mevcut modlar değişmez (Açık/Kapalı ilkesi).

```ts
export interface GameMode<TInput, TOutput> {
  readonly id: string; // "common-players"
  readonly title: string;
  readonly inputSchema: ZodType<TInput>;
  execute(input: TInput, deps: GameModeDeps): Promise<TOutput>;
}
```

`GameModeDeps` yalnızca **port** arayüzlerini taşır (repository'ler, önbellek). Mod kodu Prisma'yı doğrudan görmez.

### Planlanan Modlar

| Mod                       | Açıklama                                              | Durum                         |
| ------------------------- | ----------------------------------------------------- | ----------------------------- |
| **Ortak oyuncu** (MVP)    | İki kulüpte de oynamış oyuncular                      | ✅ Faz 3                      |
| **3×3 ızgara**            | Satır/sütun kriterlerini sağlayan oyuncu bulma        | ✅ Faz 4.4 — §9.1             |
| **İstatistik eşleştirme** | Her istatistik için değeri en yakın oyuncuyu bulma    | ✅ Faz 4.6 — §9.2             |
| **Hangisi daha**          | Seçilen istatistikte iki oyuncuyu karşılaştırma       | ✅ Faz 4.10 — §9.3            |
| Kariyer bilmecesi         | Kulüp geçmişi verilir, oyuncu tahmin edilir           | Tam kariyer verisi gerektirir |
| Bağlantı zinciri          | İki oyuncu arasında ortak kulüp üzerinden en kısa yol | Tam kariyer verisi gerektirir |

> **Kariyer bilmecesi ve bağlantı zinciri neden ertelendi.** İkisi de oyuncunun kulüp geçmişini TAM olarak bilmeyi gerektirir; §1.3'teki kapsam sınırı gereği bu yirmi dört lig dışındaki kariyerler çekilmiyor. Güney Amerika'da oynamış bir oyuncunun o dönemi görünmez — bilmece eksik bir kariyer üzerinden kurulur ve bağlantı zincirinin bulduğu "en kısa yol" gerçekte en kısa olmayabilir. 3×3 ızgara bu sınırdan etkilenMEZ: sorusu "bu kulüpte oynadı mı", "başka nerede oynadı" değil.

**"Az mı çok mu" bu listeden çıktı çünkü gerçekleşti:** §9.3'teki "Hangisi daha" tam olarak o moddur. Listede "veri %73 dolu, havuz daralır" notuyla duruyordu; ölçüm bunu düzeltti — havuz istatistiğe göre 3.333–6.464 arasında ve karşılaştırma altı istatistiğin hepsini değil yalnızca sorulanı gerektiriyor (BR-31).

Bu modlar mevcut `Spell` modelini kullanır; yeni tablo değil, yeni **alan** gerektirirler. Şema bu genişlemeye göre tasarlandı (§5.2'deki `appearances`, `goals`, `nationality` alanları şimdiden mevcut).

### 9.1 3×3 Izgara

Üç satır ve üç sütun kriteri; her hücreye **iki kriteri de sağlayan** bir oyuncu yazılır. Sütunlar her zaman kulüptür; satırlar kulüp veya ülke olabilir.

#### Ölçüm: üretilebilirlik

Izgaranın rastgele üretilebilmesi tasarımın ön koşuluydu; ölçüldü (200 tohum, gerçek veri):

| Yapılandırma           | Geçerli ızgara | Ort. deneme | Hücre başına cevap (medyan) |
| ---------------------- | -------------- | ----------- | --------------------------- |
| 324 kulüp, alt sınır 3 | 200/200        | 2,3         | 7                           |
| 120 kulüp, 5–200 cevap | 150/150        | 1,8         | 22                          |
| **60 kulüp, 5–150**    | **150/150**    | **1,1**     | **24**                      |

Üretim ~9 ms sürüyor. Yani mod teknik olarak mümkün — ama **oynanabilir değil**, ve sebebi aşağıdaki bulgu.

#### Ölçüm: "oyuncu sayısı" ünlülük DEĞİL, YAŞ ölçer

İlk tasarım kulüp havuzunu "en çok oyunculu N kulüp" diye seçiyordu. Ölçüm bunu çürüttü — en çok oyunculu 60 kulüp şunları içeriyor:

```
Genoa (1313)  Birmingham City (1303)  Brentford (1294)  Bradford City (1183)
Blackpool (1105)  Oldham Athletic (905)  Calcio Padova (866)  SPAL (734)
```

…ve şunları **içermiyor**: Real Madrid (824), Bayern (766), PSG (588), Galatasaray (681). Sebep açık: oyuncu sayısı kulübün kaç yıldır var olduğunu ölçüyor, ne kadar tanındığını değil.

Veride tanınırlık sinyali arandı, **yoktur**:

| Aday sinyal | Ölçüm                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| `leagueId`  | 388 kulübün 388'inde dolu — ayırt etmiyor                                   |
| `crestUrl`  | Yalnızca 114 kulüpte; Real Madrid, PSG, Man Utd, Arsenal, Fenerbahçe'de YOK |

Tanınırlık ölçülebilir bir veri değil, bir **ürün kararıdır**. Bu yüzden ızgara havuzu **küratörlüdür** ve QID ile sabitlenmiştir — `db:verify`'daki zorunlu kulüp listesiyle aynı gerekçe (§8.2): ada güvenmek bu projede dört kez yanılttı.

#### Havuz: 82 kulüp, ürün sahibi tarafından seçildi

Veri kümesindeki 345 seçilebilir kulübün tamamı — ligiyle ve oyuncu sayısıyla — ürün sahibine sunuldu; aşağıdaki 82'yi kendisi seçti. Bu bir ölçüm sonucu değil, kayıt altına alınmış bir karardır:

| Lig            | Kulüp |
| -------------- | ----- |
| Premier League | 20    |
| Bundesliga     | 15    |
| Serie A        | 13    |
| La Liga        | 13    |
| Ligue 1        | 12    |
| Süper Lig      | 9     |

Havuzdaki 82 QID'nin 82'si veri kümesinde çözüldü (0 eksik). Liste `src/application/game-modes/grid/pool.ts` içinde; değiştirmek bir kod değişikliğidir.

#### Ölçüm: küratörlü havuzla üretim (365 gün, gerçek veri, gerçek depolar)

| Ölçüt              | Sonuç                                        |
| ------------------ | -------------------------------------------- |
| Geçerli ızgara     | **365/365**                                  |
| Hiç çıkmayan kulüp | **0** — 82 kulübün hepsi en az 4 kez         |
| Üretim süresi      | 432 ms/ızgara (gün başına bir kez, §9.1)     |
| Ülke kriteri payı  | 408 / 2.190 kriter yuvası (%18,6)            |
| Hücre başına cevap | min 5 · medyan 9 · p75 21 · p95 62 · max 103 |

Hücre alt sınırı `MIN_CELL_ANSWERS = 5` ölçülen minimumla birebir örtüşüyor: üretim BR-9'u gerçekten uyguluyor, band dışı hücre hiç geçmedi.

**Kullanım sıklığı ligin değil, kesişimin işlevi.** En sık çıkan kulüpler Arsenal (63), Liverpool (62), Chelsea (62); en seyrek Göztepe (4), Athletic Bilbao (4), Union Berlin (4). Athletic Bilbao 743 oyuncusuna rağmen seyrek çünkü yalnızca Bask oyuncu kadrosuna alır — diğer kulüplerle kesişimi küçüktür. Bu bir kusur değil, verinin doğru yansıması.

**Üretim maliyeti neden 432 ms.** Her kriter için ayrı bir kimlik sorgusu atılıyor. Bu maliyeti günün yalnızca ilk isteği öder: sonuç gün anahtarıyla süreç içinde önbelleklenir (`daily-grid.ts`) ve 200 yanıtı CDN'de de önbelleklenebilir (§7.9). Izgara deterministik olduğu için (BR-11) iki sunucu örneği aynı gün için aynı sonucu üretir.

#### Ölçüm: ülke ekseni

Ülke × kulüp kesişimleri **iki kutuplu**: medyan 4, p95 557. Yani ya birkaç oyuncu (tahmin edilemez) ya da yüzlerce (bedava — "Bayern'de oynamış bir Alman"). Ölçülen dağılımda çiftlerin yalnızca **%40'ı** 5–150 bandına düşüyor. Ülke satırları bu yüzden bandın içinde kalacak şekilde seçilir; sağlanamazsa ızgara kulüp satırlarıyla kurulur.

#### Ölçüm: kullanıcı ızgarası SERBEST seçimle kurulamaz (2026-08-07)

"Sen kur" tasarlanırken ilk akla gelen biçim denendi: kullanıcı altı kulübü
serbest seçer, sunucu geçerli mi diye bakar. Ölçüm bunu çürüttü — rastgele
altı kulüp seçilip dokuz hücrenin hepsinde cevap aranırsa:

| Havuz                     | Dokuz hücrede ≥1 cevap | Dokuz hücrede ≥5 cevap |
| ------------------------- | ---------------------- | ---------------------- |
| Tüm seçilebilir 906 kulüp | **%0,1**               | %0,0                   |
| Küratörlü 82 kulüp        | %30,8                  | **%0,2**               |

Sebep çift düzeyinde görünüyor. 906 kulübün 409.965 olası çiftinden:

| Ortak oyuncu  | Çift    | Oran     |
| ------------- | ------- | -------- |
| ≥1            | 118.247 | %28,8    |
| BR-9 bandında | 21.895  | **%5,3** |
| 150'den fazla | 6       | %0,001   |

Yani serbest seçimde kullanıcının denemelerinin neredeyse tamamı reddedilirdi
— `scoreableFor` ve `targetable` süzgeçlerinin kaldırmak için eklendiği
duvarın aynısı (BR-16, BR-24). **Üçüncü kez aynı ders:** seçici, doğrulayıcının
kabul edeceğini göstermezse mod kullanılamaz.

**Kılavuzlu seçimde tablo tersine dönüyor.** Sütunlar birbiriyle hiç
kesişmediği için (bir hücre her zaman satır × sütundur) sütun seçimi
serbesttir; süzgeç yalnızca satırlara uygulanır ve orada bol aday kalıyor:

| Seçilen üç sütun                    | Küratörlü 82'de | 906 kulüpte |
| ----------------------------------- | --------------- | ----------- |
| Galatasaray · Fenerbahçe · Beşiktaş | 26              | 62          |
| Real Madrid · Barcelona · Atlético  | 31              | 77          |
| Man Utd · Liverpool · Arsenal       | 34              | 83          |

(BR-9 bandını sağlayan satır adayı sayısı. Tek kulüp seçiliyken — örneğin
Galatasaray — 906 kulübün 108'i bandda kesişiyor.)

**ÜST SINIR BEKLENMEDİK BİR İŞ YAPIYOR.** Bandın 150 üst sınırını aşan altı
çiftin **beşi ikiz kulüp** (§5.3): Gençlerbirliği × Gençlerbirliği (394), IFK
Norrköping (237), Örgryte (222), Ancona (220), Vicenza (186). Yalnızca RCD
Espanyol × Barcelona (174) gerçek bir futbol olgusu. Yani BR-9'un üst sınırı,
kapatılamayan ikiz kusurunu seçiciden sessizce eliyor — "Ancona'da ve A.C.
Ancona'da oynamış" hücresi kullanıcıya hiç sunulmuyor.

Ülke ekseninde süzgeç daha da gerekli: 906 kulüp × tüm uyruklar için boş
olmayan 31.472 kesişimin yalnızca **%17,2'si** bandda.

#### "Sen kur" — ızgarayı kullanıcı kurar

Günlük ızgara olduğu gibi kalır; yanına ikinci bir giriş eklenir. Sıra
üretim algoritmasının sırasıdır (`generate.ts`): önce üç sütun, sonra üç
satır.

1. **Üç sütun** — kulüp, süzgeçsiz. İki sütun birbiriyle hiç kesişmez,
   dolayısıyla kısıtlamanın anlamı olmazdı.
2. **Üç satır** — kulüp veya ülke, seçilen ÜÇ SÜTUNLA da BR-9 bandında
   kesişenlerle sınırlı. Süzgeç burada zorunlu (yukarıda ölçüldü).

**Havuz küratörlü DEĞİL: 906 seçilebilir kulübün hepsi.** Gerekçe "Sen
seç"tekiyle aynı (§9.2): seçen kullanıcının kendisi olduğunda tanınırlık
süzgecinin işi kalmaz. Küratörlü 82 kulüp günlük ızgaranın havuzu olarak
DURUYOR — orada oyuncuyu sistem seçtiği için tanınırlık hâlâ gerekli.

**Izgara SAKLANMAZ**, "Sen seç" turuyla aynı gerekçe (§9.2): günlük ilerleme
gün anahtarına yazılır çünkü "bugünün ızgarası" tekildir; kullanıcı burada
istediği kadar ızgara kurabilir ve hepsini saklamak depoyu sınırsız
büyütürdü.

**ÖLÇÜTLER İSTEMCİDEN GELİR VE BU YALNIZCA BURADA GÜVENLİDİR.** Günlük
ızgarada sunucu ölçütlere asla güvenmez, ızgarayı tohumdan yeniden üretir
(BR-11/BR-12): istemci ölçüt gönderebilseydi kendi ızgarasını uydurup her
cevabı doğru yaptırabilirdi. Kullanıcı ızgarasında uydurulacak bir şey yok —
ızgarayı zaten kullanıcı kurdu, skor kaydedilmiyor, sıralama yok. Sunucu yine
de ölçütlerin VAR OLDUĞUNU doğrular (kulüp seçilebilir mi, ülke kodu tanınıyor
mu) ve cevabı kimlikle denetler; ayrıştırılmamış girdi iç katmanlara geçmez
(§2.3).

**BR-9 kullanıcı ızgarasında da AYNEN geçerlidir** ve gevşetilmedi. Tek
cevabı olan bir hücre bilgi değil şans sorar; ızgarayı kullanıcının kurmuş
olması bunu değiştirmez. Bandın uygulandığı yer seçicidir: geçersiz bir
kombinasyon listeye hiç gelmez.

**ÜLKELER LİSTENİN BAŞINDA, ama en çok YARISINI kaplar.** Ölçüldü
(Galatasaray · Fenerbahçe · Beşiktaş sütunlarıyla): bandda kalan uyruk sayısı
**8**, kulüp sayısı **62**. Ülkeler sona konsaydı sayfa kelepçesinin altında
hiç görünmezlerdi; kelepçeyi tek başlarına doldurmaları da kulüpleri
gizlerdi.

**SÜTUN SEÇİCİSİNİN ARAMASIZ İLK LİSTESİ KÜRATÖRLÜ HAVUZDUR.** Kulüp
araması alfabetiktir ve süzgeçsiz ilk sayfa "08 Homburg", "1. FC Heidenheim"
ile açılıyordu — yani kutuyu açan kullanıcı hiç tanımadığı kulüpler görüyordu.
Tanınırlık ölçülebilir bir veri DEĞİL (yukarıda ölçüldü: oyuncu sayısı kulübün
yaşını ölçüyor), bu yüzden ilk liste ürün sahibinin seçtiği 82 kulüptür ve
sunucuda hazırlanıp sayfayla birlikte gelir. **Havuz bir SINIR değil:**
kullanıcı bir harf yazdığı anda 906 seçilebilir kulübün tamamı aranır. Günlük
ızgarada havuz bir sınırdır (§9.1 havuz kararı); burada yalnızca bir
başlangıç.

**SATIR ADAYI KALMADIĞINDA NE YAPILACAĞI SÖYLENİR.** Üç sütun hiç oynanabilir
satır bırakmayabilir; kullanıcının yapabileceği tek şey bir sütunu
değiştirmektir. Seçici bu durumda "Sonuç yok" demez, doğrudan bunu söyler —
aksi hâlde kullanıcı arama kutusunda boşuna dener.

**MALİYET ÖLÇÜLDÜ ve KENDİ BÜTÇESİNE alındı.** Süzgeç, kısıt başına bir sayım
sorgusu atıyor (kulüp ve uyruk adayları tek `UNION ALL` içinde). En kötü durum
5×5'tir ve `npm run bench` onu ölçer:

| Yol                        | Ölçülen                               |
| -------------------------- | ------------------------------------- |
| Soğuk (kısıtlar ilk kez)   | medyan ~71–83 ms · **p95 134–152 ms** |
| Sıcak (kullanıcı yazarken) | medyan **1,2 ms** · p95 **1,6 ms**    |

Kısıt başına sonuç ÖNBELLEKLENİYOR (§7.1 gereği sınırlı: 128 ölçüt).
Bayatlama riski yok — veritabanı salt-okunur bir derleme çıktısı (§3.1).
Kullanıcının yazarken ödediği maliyet bu yüzden soğuk sayı değil, **1,6 ms**.

**KAPI 150 DEĞİL 250 ms.** §1.4'ün 150 ms'i ortak oyuncu sorgusu için ölçülüp
konmuştu; süzgecin soğuk p95'i 134–152 ms aralığında salınıyor, yani 150'lik
bir kapı ölçümden ölçüme düşerdi. BR-22'nin tavanında aynı hata bir kez
yapılmıştı (ölçülen 140'a 150 kapısı) ve ölçülen değerin iki katına çekilerek
düzeltilmişti; burada aynı ölçek baştan uygulandı.

**BİR İYİLEŞTİRME DENENDİ VE ÖLÇÜM ONU ÇÜRÜTTÜ.** "Önce bir kısıtı sor,
sonrakileri AYAKTA KALAN adaylarla sınırla" biçimi sezgisel olarak daha ucuz
görünüyordu; ölçüldüğünde p95 **143,3 → 332,2 ms** çıktı. İki sebep: yüzlerce
kimliklik bir `IN (...)` listesi `spells(clubId, playerId)` indeksinin işini
bozuyor, ve zincir sorguları sıraya sokarak paralellikten de vazgeçiyor.
Değişiklik geri alındı; gerekçesi kodda duruyor ki aynı sezgi ikinci kez
denenmesin.

#### Ölçüm: kullanıcı ızgarasında BOYUT (2×2 … 5×5)

"Sen kur" turunda ızgara boyutu seçilebilir. Boyut büyüdükçe satır adayı
azalır — çünkü aday, seçilen **her** sütunla bandda kesişmek zorunda ve koşul
sayısı boyutla artıyor. Ölçüldü (400 rastgele sütun kümesi, her boyut için):

| Boyut | Küratörlü 82'den yeterli aday (≥N) | Hiç aday yok | Tüm 906'dan yeterli aday |
| ----- | ---------------------------------- | ------------ | ------------------------ |
| 2×2   | **%98,0**                          | %0,0         | %39,8                    |
| 3×3   | %83,8                              | %3,3         | %5,8                     |
| 4×4   | %45,0                              | %10,0        | %0,5                     |
| 5×5   | **%21,5**                          | %19,8        | **%0,0**                 |

**RASTGELE SEÇİM YANILTICI BİR ÖLÇÜTTÜR ve bu ölçüm onu gösteriyor.** Aynı
sütunlar tanınmış kulüplerden seçildiğinde 5×5 rahatça kuruluyor:

```
Real Madrid · Barcelona · Atlético · Sevilla · Valencia    → 75 aday
Man Utd · Liverpool · Arsenal · Chelsea · Everton          → 79 aday
Galatasaray · Fenerbahçe · Beşiktaş · Trabzonspor · Bursa  → 40 aday
```

Fark tesadüf değil: rastgele bir kulüp çoğunlukla küçük bir kulüptür ve küçük
kulübün kesişimi de küçüktür. Kullanıcı ise tanıdığı kulübü seçer — sütun
seçicisinin arama**sız** ilk listesinin küratörlü havuz olması (yukarıda) bu
davranışı ayrıca destekliyor.

**DÖRT BOYUT DA SUNULUYOR, çıkmaz ise ANLATILIYOR.** 5×5'te sütunların hiç
satır bırakmama olasılığı %19,8 ve bu kabul edildi: seçici o durumda "Sonuç
yok" demiyor, bir sütunu değiştirmesi gerektiğini söylüyor. Boyutu ölçüme
göre kısmak (ör. yalnızca 2×2 ve 3×3) ürün kararı olurdu; ölçüm bir arıza
göstermiyor, yalnızca bir bedel gösteriyor.

**SÜTUNLAR BİRBİRİNE GÖRE SÜZÜLMÜYOR ve bu bilinçli.** "Önceki sütunlarla
kesişen kulüpleri göster" demek işe yarar bir vekil gibi görünüyor ama
KURALIN KENDİSİ DEĞİL: iki sütun asla aynı hücrede karşılaşmaz. Vekili kural
diye uygulamak, geçerli birleşimleri (kesişimi küçük ama ortak satır ortağı
bol iki kulüp) sessizce eleyecekti.

**Günlük ızgara 3×3 KALIR.** Boyut, herkesin aynı ızgarayı gördüğü bir yerde
(BR-11) kullanıcıya bırakılamaz; ayrıca §9.1'in üretilebilirlik ölçümü 3×3
için yapıldı.

#### Kurallar

- **BR-9 — Hücre geçerliliği.** Bir hücre, satır ve sütun kriterlerinin **ikisini birden** sağlayan en az `MIN_CELL_ANSWERS` oyuncu içermelidir. Dokuz hücrenin biri bile sağlamıyorsa ızgara üretilmemiş sayılır.
- **BR-10 — Tekrar yok.** Bir oyuncu tek bir ızgarada yalnızca bir hücrede kullanılabilir.
- **BR-11 — Günlük ızgara.** Izgara tarihten türetilen bir tohumla **deterministik** üretilir: aynı gün herkes aynı ızgarayı görür. Gerekçe iki katlı — (1) yanıt önbelleklenebilir hâle gelir (§7.9), rastgele ızgara CDN önbelleğini işlevsiz kılardı; (2) ileride skor tablosu (§9) ancak herkes aynı soruyu çözerse anlamlı olur.
- **BR-12 — Cevap kimlikle doğrulanır.** Kullanıcı bir oyuncu **seçer**, ad yazmaz; doğrulama `playerId` üzerinden yapılır. Ada göre eşleştirme bu projede dört kez yanılttı (§10.1); "Shevchenko" arayan kullanıcı "Andriy Şevçenko" kaydını bulamazdı.
- **BR-13 — Hücre sayısı kadar tahmin hakkı.** Günlük ızgarada dokuz hücre, dokuz hak; kullanıcı ızgarasında **N×N hücre, N² hak** (BR-27). Sayı hücre sayısından TÜRETİLİR, ayrıca yazılmaz: yanlış bir tahmin bir hücreyi harcar. Sınırsız deneme, ızgarayı bir bilgi sorusundan bir **arama alıştırmasına** çevirirdi — kullanıcı listeyi tarayıp doğruyu bulana kadar denerdi. Hak sayısı hücre sayısından türetilir, ayrıca yazılmaz. Doğrulanamayan bir cevap (ağ hatası) hak **harcamaz**: kullanıcının yapmadığı bir hatanın cezası olurdu.
- **BR-25 — Kullanıcı ızgarası KILAVUZLU kurulur.** "Sen kur" turunda satır adayları, seçilmiş üç sütunun **hepsiyle** BR-9 bandında kesişen ölçütlerle sınırlıdır; seçici yalnızca bunları gösterir. Serbest seçim ölçülerek elendi: rastgele altı kulübün %0,1'i geçerli ızgara veriyor (yukarıda).
- **BR-26 — Kullanıcı ızgarasında ölçütler istemciden gelir.** Sunucu ölçütleri yeniden ÜRETMEZ, yalnızca **var olduklarını** doğrular (kulüp seçilebilir mi, ülke kodu tanınıyor mu) ve cevabı kimlikle denetler (BR-12). Bu kabul günlük ızgara için GEÇERSİZDİR: orada ızgara herkes için aynıdır ve tohumdan yeniden üretilir (BR-11).
- **BR-27 — Kullanıcı ızgarasının boyutu seçilebilir.** "Sen kur" turunda boyut **2×2, 3×3, 4×4, 5×5** arasından seçilir; günlük ızgara **3×3 kalır** (BR-11 gereği herkes aynı ızgarayı görmeli). Diğer bütün kurallar boyuttan bağımsızdır: BR-9 bandı aynen uygulanır, BR-13'ün hak sayısı hücre sayısından türer, BR-25'in süzgeci seçilen **her** sütuna karşı çalışır.

#### Seçici hedef hücreye kenetli (10 Ağustos 2026)

Oyuncu seçici tablonun **tamamından sonra** basılıyordu. Sol üst hücreye tıklayan kullanıcı, doldurduğu hücreyi göremeyecek kadar aşağıda bir girdiyle karşılaşıyordu; hangi hücreyi doldurduğu yalnızca seçicinin etiketindeki metinden anlaşılıyordu. Artık **konumdan** da belli: panel hücrenin `td`'si içinde, altına açılıyor. Son sütunda sağa yaslanıyor, yoksa görünür alanın dışına taşardı.

**`overflow-x-auto` kaldırıldı ve bu bir gerileme değil.** Sütun genişlikleri yüzde, ölçüt etiketleri sarıyor (`text-balance`) — tablo yatayda zaten taşmıyordu. Buna karşılık CSS'te bir eksen `visible` olmaktan çıkınca diğeri de `auto`ya döner: o sınıf **dikeyde** bir kırpma bağlamı yaratıyordu ve kenetlenen paneli kesecekti.

Konum bir testle tutuluyor — seçici, tıklanan hücrenin `td`'sinin içinde mi? Sınıf adına değil **yapıya** bakıyor; sayfa dibine geri taşıyan bir değişiklik kırmızıya döner.

#### Sol üst köşe artık ölü alan değil

Köşe hücresi boştu. Şimdi kalan hakkı **sayıyla değil işaretlerle** taşıyor: her hak bir kare, harcanan kareler dolu. Sayı zaten künye tabelasında yazılı (§7.15) ve ikinci kez basmak bilgi eklemezdi; işaret sırası ise sayının vermediğini veriyor — harcanan ve kalan hak, okumadan sayılabilecek bir biçimde.

Köşe **başlık değildir** (`td`, `th` değil): satır ya da sütun tanımlamıyor, `scope` almıyor. İşaretler `aria-hidden`, çünkü aynı bilgi tabelada ve alttaki metinde zaten var. Bir test köşenin başlık sayılmadığını doğruluyor — `th`'ye dönerse ekran okuyucu ızgarada dört sütun başlığı sayardı.

#### BR-10 şu an yalnızca istemcide zorlanıyor

Sunucu, bir ızgarada hangi oyuncuların kullanıldığını **bilmez**: oturum yok, sunucu tarafı oyun durumu yok. Kullanılmış oyuncular seçici listesinden gizlenir, ama bunu aşmak mümkündür.

Bu şu an bir açık **değil**, çünkü kazanılacak bir şey yok: skor kaydedilmiyor, sıralama yok, ilerleme kullanıcının kendi tarayıcısında duruyor. Aynı gerekçe BR-13 için de geçerli — ilerleme `localStorage`'da tutulur ve silinebilir.

**Skor tablosu (§9) eklendiğinde bu tercih geçersiz olur.** O noktada oyun durumu sunucuya taşınmak zorundadır; aksi hâlde sıralamaya yazılan skor, istemcinin kendi beyanı olur. Karar §10.2'de duruyor.

#### İlerleme neden `localStorage`'da

Saklanmasaydı BR-13 anlamsız kalırdı: sayfayı yenileyen kullanıcı sıfırdan başlar, "dokuz hak" hiçbir şeyi sınırlamazdı. Sunucuda saklamak ise oturum yönetimi ve **kişisel veri saklama** demekti; §7.6'daki "kullanıcı verisi tutulmaz" kararıyla çelişirdi. Depo okunamazsa (gizli mod, dolu kota) oyun çökmez, ilerleme yalnızca kalıcı olmaz.

Depodan okunan veri **dış girdi** sayılır ve şekli denetlenmeden kullanılmaz (§2.3): kullanıcı elle düzenleyebilir, eski bir sürüm yazmış olabilir.

#### Sızıntı kuralı

Izgara yanıtı **cevapları taşımaz** — yalnızca kriterleri. Hücre başına kaç cevap olduğu da verilmez: sayı, tahmin alanını daraltan bir ipucudur ve oyunun bir parçası olarak sunulmadıkça sızıntıdır (§2.4).

### 9.2 İstatistik Eşleştirme

Her gün bir oyuncu seçilir ve **istatistikleri açıkça gösterilir**. Kullanıcı her istatistik için **ayrı bir oyuncu** seçer: değeri günün oyuncusuna en yakın olduğunu düşündüğü kişiyi. Sonunda her seçim ayrı puanlanır ve toplam yüzde verilir.

Soru "bu oyuncuyu tanıyor musun" değil, **"başka oyuncuların büyüklüklerini biliyor musun"**. Kullanıcı Cantona'nın 194 maç yaptığını görür ve buna yakın maç sayısına sahip birini bulmaya çalışır.

#### Kullanılan istatistikler

Ürün sahibi altı istatistik seçti. Üçü elimizde, üçü Wikidata'dan çekilecek:

| İstatistik     | Kaynak                      | Kapsam | Not                               |
| -------------- | --------------------------- | ------ | --------------------------------- |
| Kulüp maçı     | `Spell.appearances` toplamı | %61    | Yalnızca §1.3 kapsamındaki ligler |
| Kulüp golü     | `Spell.goals` toplamı       | %61    | Yalnızca §1.3 kapsamındaki ligler |
| Oynadığı kulüp | türetilir                   | %100   | Yalnızca §1.3 kapsamındaki ligler |
| A millî maç    | `P54` + `P1350` (yeni)      | %73    | Kural aşağıda — toplam DEĞİL      |
| Boy            | `P2048` (yeni)              | %69    |                                   |
| Kilo           | `P2067` (yeni)              | %49    |                                   |

**İki istatistik istendi ama YOK ve eklenemez.** Kayda geçiyor ki tekrar sorulmasın:

- **Sarı/kırmızı kart** — Wikidata'da böyle bir özellik **hiç yok**. Katalog tarandı: "card" geçen 14 özelliğin hepsi alakasız (`MalaCards ID`, `Yu-Gi-Oh! TCG cards ID`, `card network`). Bu veri ancak başka bir kaynakla gelir ve §7.4'teki tek-kaynak kararını değiştirir.
- **Kazandığı kupa sayısı** — takım kupaları oyuncu kaydında tutulmuyor. `P166` (aldığı ödül) var ama o **bireysel** ödüldür (Ballon d'Or, yılın kalecisi) ve ölçülen kapsamı %13 — bir oyun ekseni olamayacak kadar seyrek.

#### Ölçüm: BR-14 — millî maç TOPLANMAZ, EN BÜYÜĞÜ alınır

İlk kural "oyuncunun tüm millî takım maçlarını topla" idi. Bilinen sekiz oyuncuyla sınandı ve **4/8 tutturdu**. Sebep iki ayrı kirlilik:

```
Buffon       İtalya A 176  +  İtalya U-21  11  = 187   (beklenen 176)
Panucci      İtalya A  57  +  İtalya U-21  19  =  76   (beklenen  57)
Zubizarreta  İspanya  126  +  Bask Bölgesi  4  = 130   (beklenen 126)
```

U-21 takımları A millî takımla **aynı sınıfı** (`Q135408445`) paylaşıyor — 350 takımın 2'sinde. Bask Bölgesi ise gerçek bir millî takım, sadece FIFA üyesi değil.

**Tek takım için en çok maç** kuralı ikisini birden çözüyor: **7/8**. Tek sapma Drogba (Wikidata 104, genel kaynaklar 105) ve o kuralın değil kaynağın farkı.

| Kural                         | Doğruluk |
| ----------------------------- | -------- |
| Millî maçları topla           | 4/8      |
| **Tek takım için en çok maç** | **7/8**  |

#### Ölçüm: sorgu şekli — 9,5 saatten 5 dakikaya

Millî maç sorgusunun ilk hâli her `P54` ifadesinin takımının **sınıfını** denetliyordu. Ölçüm:

| Yaklaşım                        | Çalışan yığın | Süre/yığın | Tam çekim     |
| ------------------------------- | ------------- | ---------- | ------------- |
| Sınıf süzgeci (`?team wdt:P31`) | 40            | 17.851 ms  | **~9,5 saat** |
| `VALUES` üyelik testi           | 40            | 3.092 ms   | ~1,6 saat¹    |
| **Süzmesiz çek, JS'te süz**     | **250**       | **809 ms** | **~5 dakika** |

¹ 350 takım QID'i URL'i şişiriyor; yığın 100'de `HTTP 431`, 250'de `HTTP 414`.

Sınıf süzgeci motoru her ifadenin takımını aramaya zorluyor. Millî takım listesi **bir kez** çekilip (350 takım, 924 ms) süzme bellekte yapılınca aynı sonuç 22 kat hızlı geliyor — iki yöntemin aynı değeri verdiği 8/8 doğrulandı.

**Toplam ek ETL maliyeti: ~13 dakika** (millî maç 306 istek ≈ 5 dk, boy+kilo 306 istek ≈ 8 dk).

#### Ölçüm: günün oyuncusu havuzu

Günün oyuncusunun **altı istatistiği de** dolu olmalı; yoksa o gün bir soru eksik kalır. Ölçülen kesişim:

| Ölçüt                                                                              | Sonuç      |
| ---------------------------------------------------------------------------------- | ---------- |
| Yerel koşulu geçen (havuz kulübü, 100+ maç, 2+ kulüp, tüm dönemlerde maç+gol dolu) | 4.762      |
| Altı istatistiği de dolu (400'lük örnekten yansıtıldı)                             | **~2.060** |
| Günde bir oyuncu → kaç yıllık malzeme                                              | **~6 yıl** |

#### Ölçüm: puanlama formülü

"Yüzde puan" için ham oransal fark **adaletsiz**. Ölçülen yayılımlar: kulüp maçı sd=106, kulüp golü sd=44, kulüp sayısı sd=1,0. Aynı formül iki uçta şunu veriyor:

| Senaryo                   | Oransal            | sd-bazlı |
| ------------------------- | ------------------ | -------- |
| 400 maç hedef, 300 tahmin | %75 (fazla cömert) | %6       |
| 3 gol hedef, 8 tahmin     | **%0 (acımasız)**  | %89      |

Küçük hedeflerde oransal formül oyunu bozuyor. Kural bu yüzden istatistiğin **kendi yayılımına** göre normalize eder.

#### Ölçüm: kapsam bildirimi kodla çelişiyordu (2026-08-07)

Arayüz yıldızlı sayılar için _"yalnızca kapsanan yirmi dört ligdeki kariyeri
kapsar"_ diyordu. Kod ise değerleri **82 küratörlü kulüpte** hesaplıyordu.
Ölçülen fark:

| Oyuncu             | Gösterilen | 24 ligdeki gerçek | Kulüp (küratörlü/tümü) |
| ------------------ | ---------- | ----------------- | ---------------------- |
| Éric Cantona       | 235        | **408**           | 4/9                    |
| Zlatan Ibrahimović | 435        | **605**           | 6/9                    |
| Didier Drogba      | 326        | **468**           | 3/6                    |
| Cristiano Ronaldo  | 626        | **758**           | 3/5                    |

**Kusur her lig turunda büyüdü.** Dipnot "altı lig" → "on iki" → "yirmi dört"
diye genişletildi; hesap 82 kulüpte kaldı. Genişletme turlarında metin
güncellenirken neyi kapsadığı hiç denetlenmedi — yanlış ifade her turda bir
kez daha onaylandı.

**Kök sebep: küratörlü liste iki ayrı işi birden yapıyordu.** Hem "bu oyuncu
tanınır mı" süzgeci hem "sayılar neyi kapsar" tanımıydı. İkisi ayrıldı:

- **Tanınırlık süzgeci küratörlü kalır.** Günün oyuncusu, küratörlü
  kulüplerde 100+ maç yapmış ve 2+ küratörlü kulüpte oynamış olmalıdır.
  Amaç değişmedi: kullanıcının hiç duymadığı bir isme altı soru sorulmasın.
- **Değerler 24 ligi sayar.** Maç, gol ve kulüp sayısı kapsamdaki TÜM
  kulüpleri toplar. Dipnot artık yazdığı şeyi kapsıyor.

**Ölçülen bedel.** Tam kapsamda "hiçbir dönemde eksik değer olmasın" koşulu
sertleşiyor, çünkü oyuncunun daha çok dönemi denetleniyor:

| Havuz                                       | Oyuncu    |
| ------------------------------------------- | --------- |
| Eski (uygunluk ve değerler küratörlü)       | 2.035     |
| Eksik denetimi olmasaydı                    | 2.158     |
| **Yeni (uygunluk küratörlü, değer 24 lig)** | **1.927** |

231 oyuncu tam kapsam denetimine kurban gidiyor. Kabul edildi: havuz yine de
`db:verify`'ın bir yıllık malzeme alt sınırının (365) **beş katından fazla**.

İlk satır (2.035) eski kodla ölçüldü ve o kod artık yok; diğer iki satır
BR-22 mutabakatından SONRA yeniden ölçüldü. Kural değişikliği havuzu yedi
oyuncu büyüttü — eksik gol yüzünden elenen kayıtlar geri geldi.

#### "Sen seç" — hedefi kullanıcı belirler

Günlük tur olduğu gibi kalır; yanına ikinci bir giriş eklenir. Kullanıcı hedef
oyuncuyu kendisi arar ve seçer, sonra aynı altı istatistiği aynı kurallarla
oynar.

**Neden ayrı bir havuz.** Günlük turda tanınırlık süzgeci gerekliydi çünkü
oyuncuyu sistem seçiyordu. Burada seçen kullanıcı: kimi seçtiğini zaten
biliyor, dolayısıyla süzgeç yalnızca engel olurdu. Havuz ölçütü ikili: **altı
istatistiği de dolu** ve **100+ maç** (puanın anlamlı olması için).

| Havuz                                | Oyuncu    |
| ------------------------------------ | --------- |
| Günün oyuncusu (tanınırlık süzgeçli) | 1.927     |
| "Sen seç", 2+ kulüp şartı eklenseydi | 5.242     |
| **"Sen seç" (uygulanan)**            | **5.524** |

**"2+ kulüp" şartı BİLEREK YOK.** Günün oyuncusunda o şart tanınırlık içindi;
burada seçen kullanıcının kendisi. Asıl gerekçe teknik: şart kalsaydı ölçüt
bir toplamaya dönüşür ve seçicinin süzgeci onu Prisma'nın sorgu diliyle ifade
edemezdi — süzgeç ile doğrulayıcı ayrışırdı (aşağıda). Ölçülen bedel 282
oyuncu.

#### Ölçüm: seçicinin süzgeci olmadan mod kullanılamazdı

Hedef havuzu 5.524 / 132.263, yani oyuncuların **%4'ü**. Süzgeçsiz seçicide
arama sonuçlarının ne kadarının seçilebilir olduğu ölçüldü (BR-21 sıralaması,
ilk 20 sonuç):

| Arama    | Geçerli hedef | Oran |
| -------- | ------------- | ---- |
| `buffon` | 1/5           | %20  |
| `kaka`   | 2/11          | %18  |
| `sane`   | 5/20          | %25  |
| `ronald` | 7/20          | %35  |
| `zidane` | 2/4           | %50  |

Kullanıcı seçimlerinin çoğunda reddedilirdi — `scoreableFor` süzgecinin
kaldırmak için eklendiği duvarın aynısı (BR-16). Bu yüzden arama ucu
`target=true` süzgecini aldı; süzgeçle aynı aramalar Buffon, Zidane ve Leroy
Sané'yi doğrudan veriyor.

**SÜZGEÇ İLE DOĞRULAYICI BİREBİR AYNI OLMAK ZORUNDA** ve bu kural bu turda
neredeyse ikinci kez çiğneniyordu: `findStatValue` 24 lige geçirildiğinde
`scoreableWhere` hâlâ küratörlü kulüpleri süzüyordu — seçici gösterecek,
sunucu reddedecekti. İkisi birlikte güncellendi.

**BU MODUN İLK ÖLÇÜMÜ BAŞKA BİR KUSURU AÇTI.** Cristiano Ronaldo hedef
olamıyordu: Real Madrid dönemindeki gol verisi eksikti (`maç 292 · gol —`) ve
BR-15 eksik veriyle hedef kabul etmiyor. İlk tanı yanlıştı — "kaynak boşluğu,
kural kusuru değil" diye yazılmıştı. Kaynakta boşluk YOKTU: hem Wikidata hem
Vikipedi 311 golü veriyordu, veriyi atan BR-22'nin "gol maçı aşamaz" alt
kuralıydı. Kural bir önceki commit'te ikinci kaynak mutabakatıyla
değiştirildi; Ronaldo artık `maç 292 · gol 311` ile hedef seçilebiliyor ve
havuz 5.510'dan 5.524'e çıktı.

Kaydın burada durmasının sebebi var: kusuru bulan şey bu modun kendisiydi.
"Kim hedef olabilir" sorusu sorulmasaydı eksik gol kimsenin gözüne
çarpmayacaktı.

**Tur SAKLANMAZ ve bu bilinçli.** Günlük ilerleme gün anahtarına yazılır
(§9.1) çünkü "bugünün turu" tekildir. Kullanıcı burada istediği kadar tur
açabilir; hepsini saklamak depoyu sınırsız büyütürdü ve "hangi tur devam
ediyor" sorusunu doğururdu. Sayfa yenilenirse tur biter.

**BR-20 aynen korunur.** İstemci hedefin yalnızca **kimliğini** gönderir,
değerlerini değil; sunucu değerleri kendisi okur. Kullanıcının kolay bir hedef
seçebilmesi bir açık değil, modun kendisidir — sıralama tablosu yok, puan
kullanıcının kendisine ait.

#### Kurallar

- **BR-14 — Millî maç tek takımdan.** Bir oyuncunun millî maç sayısı, **tek bir millî takım için** yaptığı en çok maçtır. Toplama, U-21 kayıtlarını ve FIFA dışı takımları da katıp yanlış sonuç verir (yukarıda ölçüldü).
- **BR-15 — Günün oyuncusu tam veri ister.** Seçilebilmesi için altı istatistiğin **hepsi** dolu olmalıdır. Eksik veriyle soru sorulmaz; "bilinmiyor" bir cevap değildir.
- **BR-16 — Cevap havuzu istatistik başınadır.** Kullanıcının bir istatistik için seçebileceği oyuncular, **o istatistiği dolu olanlardır**. Altı istatistiğin kesişimiyle sınırlamak havuzu gereksiz daraltırdı; kullanıcı gol sorusunda kilosu bilinmeyen birini seçebilmelidir.
- **BR-17 — Bir oyuncu bir kez.** Aynı oyuncu birden çok istatistikte kullanılamaz; kullanıcı **her istatistik için ayrı** bir isim verir.
- **BR-18 — Puan yayılıma göre.** Bir seçimin puanı
  `100 × max(0, 1 − |seçilen − hedef| / (2 × sd))`
  formülüyle hesaplanır; `sd` o istatistiğin havuzdaki standart sapmasıdır. Toplam puan altı seçimin ortalamasıdır. Çarpan **2** ürün kararıdır ve oyunun zorluğunu ayarlayan tek sayıdır: 1 birim sapma ≈ %99, yarım sd ≈ %75, 2 sd ≈ %0.
- **BR-19 — Günlük ve deterministik.** BR-11 ile aynı: gün tohumundan üretilir, herkes aynı oyuncuyu görür, tarihi sunucu okur.
- **BR-20 — Doğrulama sunucuda.** BR-12 ile aynı: istemci hedef değerleri gönderemez, puanı sunucu hesaplar. Aksi hâlde istemci kendi hedefini uydurup %100 alırdı.

#### Arama ve veri sağlığı (her iki mod)

- **BR-21 — Oyuncu araması en çok oynayana göre sıralanır.** Ölçüt, altyapı dışı dönemlerdeki toplam maç sayısıdır (`Player.careerAppearances`, §5.2).

  Alfabetik sıra ölçülerek kullanılamaz bulundu — aranan oyuncu çoğu zaman listenin görünen kısmında bile değildi:

  | Arama    | Kastedilen oyuncu | Alfabetik sırası |
  | -------- | ----------------- | ---------------- |
  | `buffon` | Gianluigi Buffon  | 5 adayın 3.'sü   |
  | `messi`  | Lionel Messi      | 14 adayın 9.'su  |
  | `sane`   | Leroy Sané        | 51 adayın 34.'sü |

  Dönem SAYISI da denendi ve elendi: "zidane"de Luca (5 dönem) Zinedine'i (4), "kaka"da Stefano Okaka (9) Kaká'yı (3) geçiyordu. Maç sayısı üç örnekte de doğru ayırıyor (Zidane 506/2/0 · Kaká 308, Okaka 194 · Buffon 755/377/0).

  Değer **denormalize** tutulur: maç sayısı `Spell`'de durur ve Prisma ilişki toplamına göre sıralayamaz. Ham SQL'e geçmek BR-16 süzgecini ikinci bir yerde yeniden yazmak olurdu — ölçülmüş bir hata sınıfı. İkincil sıralama anahtarı alfabetiktir; oyuncuların **%33,9'unun** toplam maçı 0 ve eşitlikte sıranın sabit kalması gerekir.

- **BR-23 — Tanınırlık süzgeci ile değer kapsamı ayrıdır.** Günün oyuncusu küratörlü kulüplerde (§9.1) 100+ maç ve 2+ kulüp koşulunu sağlayanlar arasından seçilir; ancak gösterilen maç, gol ve kulüp sayıları §1.3 kapsamındaki **tüm** kulüpleri toplar. İkisini tek sorguda birleştirmek, kapsam bildirimini üç lig turu boyunca yanlış tutmuştu (yukarıda ölçüldü).
- **BR-24 — Seçilen hedef geçerli olmalıdır.** "Sen seç" turunda hedef oyuncunun altı istatistiği de dolu olmalıdır; değilse tur **reddedilir**, sessizce başka bir oyuncuya kaydırılmaz. Kullanıcı neden reddedildiğini görmezse aynı ismi tekrar dener.
- **BR-22 — Akla yatkın olmayan maç/gol sayısı `null` sayılır.** Tek dönemde 1000'i aşan değer kabul edilmez. Gol sayısı maç sayısını aştığında değer atılMAZ; ikinci kaynak (Vikipedi) aynı çifti doğrularsa korunur, doğrulayamazsa düşer.

  Sınır tahmin değil, veriden okundu — sıralamada açık bir uçurum var:

  ```
  5000  Renaldo Lopes da Cruz @ Las Palmas   ← iki yıllık dönem, imkânsız
  1987  Paolo Maldini @ Milan                ← maç sayısı değil, KATILIŞ YILI
  ─────────────────────────────────────────  sınır 1000
   770  John Trollope @ Swindon Town         ← gerçek İngiltere rekoru
  ```

  **"GOL MAÇI AŞAMAZ" ALT KURALI KALDIRILDI — öncülü yanlıştı (2026-08-07).**

  Elit golcüler maç sayısından fazla gol atar. Kural koşuda **1.102 dönemi**
  kesiyordu ve kestiklerinin arasında Ronaldo'nun Real Madrid kaydı vardı:
  **292 maç / 311 gol**. Wikidata bu değeri veriyordu, Vikipedi de aynısını
  söylüyordu (`caps4 = 292`, `goals4 = 311`); veriyi atan tek şey bizim
  kuralımızdı. Sonucu iki yerde görünüyordu — sayı sitede eksikti ve oyuncu,
  altı istatistiğin de dolu olmasını şart koşan aday havuzuna (BR-15) hiç
  giremiyordu.

  **Yerine ikinci kaynak mutabakatı geldi.** Wikidata'nın çifti, Vikipedi'nin
  AYNI dönem için verdiği çiftle karşılaştırılır; maç ve gol birebir aynıysa
  değer korunur, değilse düşürülür. Karşılaştırma ÖZGÜN Wikidata çiftiyle
  yapılır — birleştirme maç sayısını ezmiş olabilir ve ezilmiş değere bakmak
  kaynağı kendi kendisiyle doğrulatmak olurdu.

  **Ölçüldü:**

  | Sonuç                         | Çevrimdışı tahmin | **Koşuda ölçülen** |
  | ----------------------------- | ----------------- | ------------------ |
  | Vikipedi doğruluyor → korunur | 76                | **140**            |
  | Doğrulanamadı → düşer         | 850               | **962**            |
  | toplam etkilenen dönem        | 926               | **1.102**          |

  **İKİ PAYDA AYNI DEĞİL, bu yüzden 76 → 140 birebir karşılaştırma değildir.**
  Çevrimdışı ölçüm veritabanındaki 926 dönemi görüyordu; kural ise yüklemeden
  önce, normalleştirilmiş evrende çalışıyor ve orada 1.102 dönem var. Geçerli
  sayı koşuda ölçülendir.

  **Tahmin yine de DÜŞÜK kaldı ve sebebi ölçüldü.** Çevrimdışı ölçüm yalnızca
  önbellekteki sayfaları okuyabiliyor ve dönemleri MAÇ SAYISI vekiliyle
  eşleştiriyordu; boru hattı ise kulüpleri QID ile çözüyor, beş dili ve
  yönlendirme takma adlarını da tarıyor. Yani gerçek mutabakat, elle kurulan
  vekilden güçlü çıktı.

  Oran düşük (%13) ama **kurtulanlar tanınmış oyunculardır**; hasar orada
  yoğunlaşıyordu. 150+ maçlık kayıtlarda yöntem 12 vakanın 12'sinde de doğru
  karar verdi:

  ```
  Ronaldo         292/311  · Vikipedi 311  → korundu
  Zeki R. Sporel  352/470  · Vikipedi 470  → korundu
  Ottmar Walter   275/295  · Vikipedi 295  → korundu
  (kaleci)        208/343  · Vikipedi   0  → düştü
  (bozuk kayıt)   156/5603 · Vikipedi  56  → düştü
  ```

  Düşenlerin hepsi çürütülmüş değil: çevrimdışı ölçümde 926 dönemin yalnızca
  138'ine Vikipedi açıkça karşı çıkıyordu, 712'si karar verilemediği için
  düşüyor ve bunların neredeyse tamamı çok küçük kayıtlar (1 maç/4 gol gibi).
  Koruma zayıflamadı: `--skip-wikipedia` ile koşulduğunda hiçbir kayıt
  doğrulanamaz ve hepsi düşürülmüş kalır.

  **`db:verify` artık sıfır beklemiyor**, tavan bekliyor (300; ölçülen 140).
  Sıfır beklemek kuralın kendisini geri getirirdi. Tavan ilk olarak çevrimdışı
  tahmine göre 150 konmuştu; koşu 140 ölçünce pay kalmadığı görüldü ve rutin
  bir veri tazelemesinin kapıyı düşürmemesi için 300'e çekildi.

  **Kaleci kusuru ayrı bir borç.** Ölçüm sırasında görüldü: Vikipedi
  kalecilerin YEDİĞİ golü `-87` gibi negatif yazıyor ve bu değerler
  Wikidata'ya pozitif gol olarak girmiş olabiliyor (Ottavio Bugatti 256 maç
  / 329 "gol"). Mutabakat kuralı bunları zaten düşürüyor ama kaynağı
  temizlemiyor; §10.2'ye borç olarak yazıldı.

  Gollerde de aynı kalıp (5603, 5509, 2000, 1817 — hepsi yıl kılıklı); en yüksek gerçek değer Messi'nin Barcelona'daki 474'ü, yani sınır hiçbir gerçek kaydı kesmiyor. Gol sayısının maç sayısını aştığı **1.102 dönemde** karar mutabakata bırakılır (yukarıda); düşürülen kayıtta yalnızca gol `null` olur — maç sayısı hem BR-21'in hem BR-15 aday havuzunun girdisi olduğu için daha çok yerde kullanılıyor ve tek taraflı silinmesi daha pahalı olurdu.

  Sıfırlamak değil `null` yapmak kasıtlıdır (§2.7): "0 maç oynadı" bir iddiadır, "bilmiyoruz" ise gerçektir.

#### Kapsam bildirimi

Maç, gol ve kulüp sayısı **yalnızca §1.3 kapsamındaki yirmi dört ligi** sayar. Boca Juniors veya Flamengo'da geçen yıllar bu sayılara **girmez**. (Ajax bir zamanlar bu cümlenin örneğiydi; 12 lig turundan beri kapsamda — kapsam büyüdükçe örnek de tazelenmek zorunda.) Arayüz bunu istatistiğin yanında söyler; söylemezse kullanıcı bildiği gerçek toplamla karşılaştırıp siteyi yanlış sanır — §1.3'ün kapsam bildirimi kuralının aynısı.

---

### 9.3 Hangisi Daha

Kullanıcı §9.2'nin altı istatistiğinden **birini** ve bir **yön** seçer ("daha çok" / "daha az"). Karşısına iki oyuncu gelir, değerleri gizlidir; hangisinin daha fazla (ya da daha az) olduğunu seçer. **Doğruysa seçtiği oyuncu kalır**, karşısına yeni bir rakip gelir — her turda bir oyuncu değişir. Yanlışta koşu biter ve skor, verilen doğru cevap sayısıdır.

§9.2 ile aynı sayıları kullanır ama **başka bir soru sorar**: orada "bu değere kim yakın" diye bir büyüklük tahmini istenir, burada iki isim arasında bir **sıralama** kararı. Bu yüzden §9.2'nin BR-18 puanlaması burada hiç kullanılmaz; doğru ya da yanlış vardır.

#### Ölçüm: havuz

Havuz BR-15'in tanınırlık ölçütüyle kurulur (küratörlü kulüplerde 100+ maç, 2+ kulüp) ama §9.2'nin aksine **altı istatistiğin hepsi aranmaz** — yalnızca karşılaştırılan istatistik gerekir. Ölçüldü (2026-08-08, **6.464 tanınır oyuncu**):

| İstatistik   | Havuz | Kapsam | min | medyan | max |
| ------------ | ----: | -----: | --: | -----: | --: |
| Kulüp maçı   | 6.464 |   %100 | 100 |    305 | 962 |
| Kulüp golü   | 6.458 |   %100 |   0 |     26 | 600 |
| Kulüp sayısı | 6.464 |   %100 |   2 |      5 |  17 |
| A millî maç  | 3.578 |    %55 |   0 |     18 | 233 |
| Boy          | 4.369 |    %68 | 157 |    180 | 203 |
| Kilo         | 3.333 |    %52 |  50 |     75 | 117 |

Eksik istatistik oyunu durdurmaz, yalnızca o istatistiğin havuzunu daraltır — §9.2'deki BR-16'nın aynı davranışı. Hiçbir istatistikte "rakip bulunamadı" durumu ölçülmedi (%0,00).

#### Ölçüm: "kazanan kalır" tek başına bir SÖMÜRÜ doğuruyor

Kazanan kaldığı için kalan oyuncu her turda "o ana kadarki en büyük" olur. Rakip havuzdan rastgele çekilirse yeni oyuncunun daha büyük çıkma olasılığı n'inci turda 1/(n+2)'ye düşer — yani **hiçbir şey bilmeden "hep kalanı seç" demek kazanan bir stratejidir**. Ölçüldü (20.000 koşu, tanınır havuz):

| İstatistik   | Strateji       | medyan | p90 | p99 |  ≥10 seri | ≥25 seri |
| ------------ | -------------- | -----: | --: | --: | --------: | -------: |
| Kulüp maçı   | **hep kalanı** |      0 |  11 | 145 | **%11,0** | **%5,0** |
|              | yazı tura      |      0 |   3 |   6 |      %0,1 |     %0,0 |
| Kulüp sayısı | **hep kalanı** |      0 |  15 | 245 | **%13,7** | **%7,1** |
|              | yazı tura      |      1 |   3 |   6 |      %0,1 |     %0,0 |
| Boy          | **hep kalanı** |      1 |  14 | 315 | **%13,2** | **%7,2** |
|              | yazı tura      |      0 |   3 |   6 |      %0,1 |     %0,0 |

Diğer üç istatistikte de aynı: hep kalanı seçen %9,5–13,7 oranında 10+ seri yapıyor, p99'da 120–315 seriye ulaşıyor. Skor bilgiyi değil sabrı ölçerdi.

#### Ölçüm: dengeli rakip sömürüyü kapatıyor

Çözüm mekaniği değiştirmiyor — kazanan yine kalıyor, her turda yine bir oyuncu değişiyor. Değişen tek şey **rakibin nereden çekildiği**: yazı tura atılır, tura ise kalanın değerinden **büyük**, yazı ise **küçük** oyuncular arasından seçilir. Aynı 20.000 koşu:

| İstatistik   | Strateji       | medyan | p90 | p99 | ≥10 seri | tek yanlı tur |
| ------------ | -------------- | -----: | --: | --: | -------: | ------------: |
| Kulüp maçı   | **hep kalanı** |      0 |   3 |   6 | **%0,1** |          %7,1 |
| Kulüp golü   | **hep kalanı** |      0 |   3 |   6 | **%0,1** |         %11,8 |
| Kulüp sayısı | **hep kalanı** |      0 |   2 |   6 | **%0,1** |         %29,0 |
| A millî maç  | **hep kalanı** |      0 |   2 |   6 | **%0,1** |         %19,2 |
| Boy          | **hep kalanı** |      1 |   3 |   6 | **%0,2** |         %23,2 |
| Kilo         | **hep kalanı** |      0 |   3 |   6 | **%0,1** |          %6,5 |

Bilgisiz strateji artık yazı turayla **birebir aynı** (p90 = 3, p99 = 6). "Tek yanlı tur", kalan oyuncu uca yaklaştığı için bir tarafın boş kaldığı turların oranıdır; oyun o turda yine kurulur (tek taraftan çekilir) ve ölçüm gösteriyor ki %29'a varan tek yanlılık bile sömürüyü geri getirmiyor.

#### Ölçüm: beraberlik gerçek bir sorun

Aynı değere sahip iki oyuncuda "doğru cevap" diye bir şey yoktur. Ölçüldü:

| İstatistik   |  Berabere | Bandın elediği çift | Band |
| ------------ | --------: | ------------------: | ---: |
| Kulüp maçı   |      %0,3 |               %11,7 |   25 |
| Kulüp golü   |      %1,7 |               %10,1 |    5 |
| Kulüp sayısı | **%14,1** |           **%40,2** |    2 |
| A millî maç  |      %2,5 |               %15,6 |    5 |
| Boy          |      %4,9 |               %21,3 |    3 |
| Kilo         |      %4,6 |               %21,7 |    3 |

**Kulüp sayısı en kaba eksen** ve öyle kalıyor: yalnızca 16 farklı değer taşıdığı için rastgele iki oyuncunun %14,1'i berabere ve 2'lik band çiftlerin %40,2'sini eliyor. Listeden çıkarılmadı çünkü band uygulandığında oynanabilir (yukarıdaki tabloda sömürü kapalı); ama en dar havuz odur ve zorluk ayarı yapılacaksa ilk oraya bakılır.

Band, oyunun zorluğunu ayarlayan **tek sayıdır** — §9.2'deki `SCORE_TOLERANCE_FACTOR`'ün buradaki karşılığı. Değerler ölçülerek kondu: her biri, çiftlerin ~%10–22'sini eleyen en küçük anlamlı fark (kulüp sayısı ölçeğin kabalığı yüzünden istisna).

#### Ölçüm: maliyet

Tanınırlık havuzu 405 bin dönemi tarıyor ve süreç başına **bir kez** kuruluyor; veri bir derleme çıktısı olduğu için (§3.1) süreç boyunca değişmez. Seçim SQL'de değil, sıralı dizide ikili aramayla yapılıyor. Ölçüldü (`npm run bench`):

| Yol                          |    Ölçülen | Bütçe  |
| ---------------------------- | ---------: | ------ |
| Soğuk (havuz kurulumu dâhil) |     306 ms | 600 ms |
| Sıcak (tur başına, p95)      | **0,7 ms** | 10 ms  |

Soğuk maliyet bir "başlangıç gideri" diye kenara konamaz: sunucusuz ortamda onu ilk isteği yapan kullanıcı öder. Sıcak bütçenin ölçülenin 14 katı olması bilinçli — 1,4 ms'lik bir kapı ölçüm gürültüsünde kalırdı ve kapının koruduğu şey zaten başka: seçimin bir gün bellekten SQL'e dönmesi (o regresyon 100 ms'in üstünde olurdu).

#### Kurallar

- **BR-28 — Zincir: kazanan kalır.** Doğru cevapta **seçilen** oyuncu bir sonraki tura geçer ve karşısına yeni bir rakip gelir; her turda yalnızca bir oyuncu değişir. Yanlış cevapta koşu biter, skor doğru cevap sayısıdır. Koşu boyunca aynı oyuncu ikinci kez rakip olarak sunulmaz.
- **BR-29 — Ayırt edilebilirlik bandı.** Bir çift, ancak iki değer arasında istatistiğe özgü asgari fark varsa kurulur (kulüp maçı 25, kulüp golü 5, kulüp sayısı 2, millî maç 5, boy 3, kilo 3). Beraberlik ve kıl payı farklar ölçüldü (yukarıda); bandsız oyun bilgi değil kura sorardı — BR-9'un oynanabilirlik bandıyla aynı gerekçe.
- **BR-30 — Dengeli rakip.** Yeni rakip, kalan oyuncunun değerine göre **yazı turayla** ya büyük ya küçük taraftan çekilir. Bir taraf boşsa diğerinden çekilir ve tur yine kurulur. Rastgele çekim ölçülerek elendi: bilgisiz "hep kalanı seç" stratejisi %9,5–13,7 oranında 10+ seri yapıyordu, dengeli çekimde %0,1.
- **BR-31 — Tanınırlık havuzu.** Havuz BR-15'in tanınırlık ölçütünü kullanır (küratörlü kulüplerde 100+ maç, 2+ kulüp) ama yalnızca **karşılaştırılan** istatistiğin dolu olmasını ister. Altısını birden aramak havuzu 6.464'ten 1.927'ye düşürürdü ve bunun oyuna hiçbir katkısı yok: sorulmayan istatistiğin dolu olması gerekmiyor.
- **BR-32 — Değerler cevaptan ÖNCE istemciye gitmez.** Tur yanıtı yalnızca iki oyuncunun kimliğini ve adını taşır; sayılar cevap gönderildikten sonra dönen yanıtta açılır. BR-12 ve BR-20 ile aynı kural — değerler baştan gönderilseydi oyun tarayıcı konsolunda çözülürdü.

**Skor yereldir ve bu bilinçli.** Koşu durumu istemcide tutulur; sunucu her turu tek tek doğrular ama koşuyu hatırlamaz. Dolayısıyla ısrarlı bir kullanıcı aynı çifti tekrar tekrar sorarak kendi skorunu şişirebilir. Bu, BR-26'nın kabul ettiği riskle aynı sınıftır: skor kimseye karşı yarışmıyor, sıralama tablosu yok (§10.2). Sıralama tablosu eklenirse **bu kabul geçersizleşir** ve koşu durumunun sunucuya taşınması gerekir.

---

## 10. Yol Haritası

### Faz 0 — Temel ✅

- [x] Next.js 16 + TypeScript iskeleti, `strict` + `noUncheckedIndexedAccess`
- [x] ESLint + Prettier + güvenlik lint kuralları
- [x] Klasör yapısının kurulması (§4.2), katman sınırı lint kuralı
- [x] Güvenlik başlıkları (§7.3): sabit başlıklar + nonce'lu CSP, ölçülerek doğrulandı
- [x] Bağımlılık açıklarının kapatılması, üretim ağacı temiz (§7.7)
- [x] Vitest kurulumu, BR-6 sezon normalizasyonu ve 11 geçen test
- [x] `.gitignore`, `.env.example`, `README.md`, git deposu başlatma

### Faz 1 — Veri ✅

- [x] Prisma şeması ve ilk migration
- [x] Wikidata istemcisi: rate-limit, yeniden deneme, `User-Agent`, disk önbelleği
- [x] SPARQL sorguları: ligler → kulüpler → oyuncular/dönemler
- [x] Normalizasyon: ad/tarih/mevki, tekilleştirme, kiralık ve altyapı tespiti
- [x] Doğrulama denetimleri (§8.2), otoriter `load` adımı, `npm run db:verify`
- [x] Altı ligin tam veri çekimi

### Faz 2 — Çekirdek İş Mantığı ✅

- [x] Domain varlıkları ve değer nesneleri (markalı `ClubId`/`PlayerId`, `YearRange`)
- [x] `findCommonPlayers` use-case'i + BR-1…BR-6 birim testleri
- [x] `searchClubs` use-case'i, girdi kelepçeleme (§7.1)
- [x] Repository port'ları ve Prisma uygulamaları + kompozisyon kökü
- [x] `GameMode` sözleşmesi ve kayıt defteri (§9)
- [x] Altın veri seti ile doğruluk testleri

### Faz 3 — API ve Arayüz ✅

- [x] `/api/clubs` ve `/api/common-players` (Zod doğrulama + hız sınırı)
- [x] Ortak sarmalayıcı: iz kimliği, hata eşleme (§6.3), yapılandırılmış log
- [x] `RateLimiter` port'u + token bucket + güvenilir `X-Forwarded-For` okuma
- [x] Kulüp seçim bileşeni (arama, klavye erişimi, ARIA combobox deseni)
- [x] Sonuç listesi (dönem rozetleri, kiralık işareti, boş/hata durumları)
- [x] Duyarlı tasarım, karanlık mod
- [x] CSP nonce doğrulamasının tekrarı (§7.3)

### Faz 4 — Sertleştirme ve yayına hazırlık

Hedef: **eksiksiz bir proje**, sonra yayın. Sıra kasten bu — yayına çıkmak eksikleri kapatmaz, görünür kılar.

- [x] Sorgu performans ölçümü — `npm run bench`, p95 16,8 ms (§1.4)
- [x] Sorgu şeklinin kesişime çevrilmesi (p95 47,7 → 16,8 ms)
- [x] Güvenilmez `isCurrent` alanının sözleşmeden çıkarılması (§6.2)
- [x] Kanıt düzeyi kuralının ölçülmesi ve BR-8'in tanımlanması (§1.4, §5.4)
- [x] BR-8'in koda geçirilmesi (domain + DTO + arayüz işareti)
- [x] Arma URL'lerinin normalize edilmesi — 114/114, ölçülen 120 px kısıtıyla
- [x] Arayüzde kapsam bildirimi ve veri güncellik tarihi (`DatasetMeta`)
- [x] Önbellek politikası (§7.9)
- [x] Erişilebilirlik denetimi (WCAG 2.1 AA) — 5 ihlal bulundu ve düzeltildi (§7.10)
- [x] Güvenlik gözden geçirmesi (§7 maddelerinin tek tek doğrulanması)
- [x] CI ardışık düzeni (§8.3)
- [x] Zamanlanmış ETL iş akışı + dağıtım yapılandırması (§3.1)

### Faz 4.4 — İkinci oyun modu: 3×3 ızgara ✅

Yayından **önce** eklendi. Gerekçe Faz 4'ün gerekçesiyle aynı: mimarinin ikinci bir modu gerçekten taşıdığı ancak ikinci mod yazılınca ölçülebilir. Sözleşme (§9) değişmedi — mod, kayıt listesine bir satır eklenerek girdi.

- [x] Domain kuralları: BR-9…BR-13, deterministik günlük tohum (mulberry32)
- [x] Küratörlü kulüp havuzu — **82 kulüp**, ürün sahibi 345 kulübün tamamını görerek seçti
- [x] Üretim algoritması + 365 günlük ölçüm (365/365, 82 kulübün hepsi çıkıyor)
- [x] `GET /api/grid`, `POST /api/grid/answer`, `GET /api/players` (§6.4)
- [x] Arayüz: semantik tablo, oyuncu seçici, `localStorage` ilerleme
- [x] `db:verify`'a havuz denetimi — QID'ler veride gerçekten var mı

**Mod eklerken çıkan iki veri kusuru** (ikisi de arayüzde göründüğü için bulundu):

| Kusur                                                  | Ölçüm                                                                | Düzeltme                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------- |
| `normalizePosition` tanımadığı etiketi ham geçiriyordu | 19.897 oyuncu (%26) eşlenmemiş; ~50'sinde bakanlık, kişi adı, kriket | Kapalı küme + `db:verify` denetimi       |
| Uyruk arayüzde ham ISO kodu olarak görünüyordu         | Havuzda 30 kod elle yazılmıştı, veride **170** kod var               | `Intl.DisplayNames` + iki bilinçli sapma |

**Bir erişilebilirlik kusuru da ortaya çıktı ve `ClubPicker`'da da vardı:** `role="listbox"` yalnızca `option` çocuğu barındırabilir, "Sonuç yok" metni listenin içindeydi. Mevcut testler listeyi hep dolu kurduğu için görünmemişti; boş liste durumu artık iki seçici için de denetleniyor.

### Faz 4.6 — Üçüncü oyun modu: istatistik eşleştirme ✅

> **Numarası 4.5'ten büyük ama SIRASI önce.** Bu mod, önceki ikisinden farklı
> olarak **veri kümesini genişletiyor** — üç yeni alan çekiliyor. Yayın (4.5)
> zaten tek bir ETL koşusu içeriyor; ikisini ayırmak ~1 saatlik işi iki kez
> ödemek olurdu. Numaralar sabit kaldı çünkü "§10 Faz 4.5" belgede ve kodda
> birden çok yerde geçiyor.

- [x] Prisma şeması + migration: `nationalCaps`, `heightCm`, `weightKg`
- [x] ETL: millî takım listesi (bir kez) + oyuncu istatistik sorgusu (yığın 250)
- [x] BR-14'ün ETL'de uygulanması: **en büyük**, toplam değil
- [x] `db:verify`: yeni alanların kapsam alt sınırı
- [x] Domain: BR-15…BR-20, puanlama formülü
- [x] `GET /api/stat-match`, `POST /api/stat-match/answer` (§6.5)
- [x] Arayüz: istatistik başına seçici + sonuç kartı
- [x] Kapsam bildirimi: "bu sayılar yalnızca altı ligi kapsar"

**Yığın boyutu ölçülerek seçildi.** 250 oyuncu tek sorguda dönüyor; 500'de
`HTTP 414` (URL çok uzun). Kapsam alt sınırları `db:verify`'a kondu çünkü üç
alanın da eksik olması NORMAL (§9.2) — bir eşik olmadan alanın tamamen boş
gelmesiyle seyrek gelmesi ayırt edilemezdi.

### Faz 4.7 — İkinci kaynak: Vikipedi ✅

> **Bu da 4.5'ten önce gelir ve gerekçesi aynı.** Katman veri kümesini
> değiştiriyor; yayın zaten tek bir ETL koşusu içeriyor ve ikisini ayırmak
> ~2 saatlik işi iki kez ödemek olurdu.

Sözleşmesi §4.3'te. Kaldırılan elle düzeltme mekanizmasının yerini alır: aynı
boşluğu kapatır ama insan emeğiyle değil, ikinci bir **kaynakla** — böylece
veri kümesi kendini güncel tutabilir.

- [x] §4.3 kaynak sözleşmesi: roller, eşleştirme, altı birleştirme kuralı
- [x] Bilgi kutusu ayrıştırıcısı (`tr`+`en`, saf) — 51 birim testi, fikstürler
      gerçek makale metinleri; ana dillerle birlikte **77**
- [x] Ortak HTTP taşıma katmanı: iki istemci de aynı yeniden deneme
      sınıflandırmasını kullanır (o sınıflandırma Faz 1'de iki kez çöktü)
- [x] Vikipedi istemcisi: wikitext (akış) + yönlendirme takma adları
- [x] Birleştirme (`merge-wikipedia.ts`, saf) — kural başına test, 19 adet
- [x] ETL'e bağlanması; `--skip-wikipedia` ile katmanın kazancı ölçülebilir
- [x] Tam kuru koşu: gerçek kazanç **+%11,8** (tahmin +%9,5), +8 seçilebilir
      kulüp; katmanın veri kümesine verdiği üç hasar ölçülüp kapatıldı
- [x] Aşama 2 — ana dil ayrıştırıcıları (`it`/`de`/`fr`). Önce kazancı ölçülüp
      (**+%0,4**) yazılmaması kararlaştırıldı, karar gözden geçirildi ve katman
      yazıldı. Gerçek kazanç tahminin iki katı: **+1.788 dönem (+%0,83)**, +1
      seçilebilir kulüp, makale kapsamı %78,4 → **%95,3**. `es` ölçümle elendi
      (25 makalenin 2'sinde alan dolu, maç/gol hiç yok). Tablolar §4.3'te.
- [x] Ana dil ayrıştırıcısı 471 makalelik korpusa koşturuldu: birim testlerinin
      göremediği **iki sessiz veri kaybı** bulundu ve kapatıldı (§4.3)

**Ölçüm asıl boşluğu başka yerde buldu.** Sekiz büyük kulübün güncel kadrosu
bağımsız kaynaktan (Vikipedi kadro şablonları) okunup QID ile karşılaştırıldı:

|                 | kadro | veri kümesinde | kapsam  |
| --------------- | ----- | -------------- | ------- |
| 8 kulüp toplamı | 179   | 133            | **%74** |

Eksik 46 oyuncunun **tamamı** "oyuncu hiç yok" sınıfında — dönemi eksik olan
tek bir oyuncu bile yok. Sebep yapısal: oyuncu evrenimizi Wikidata'nın `P54`
ifadeleri tanımlıyor. Bir oyuncunun evrendeki bir kulüple `P54` bağı yoksa
veri kümesine hiç girmiyor ve **Vikipedi katmanı ona ulaşamıyor** — katman
yalnızca zaten tanınan oyuncuları zenginleştiriyor.

Eksiklerin profili tutarlı: 2003–2007 doğumlu genç oyuncular ve yeni
transferler (Leny Yoro, Patrick Dorgu, Andrey Santos, Matteo Gabbia). Wikidata
bu kayıtlarda geriden geliyor.

**Her varsayım ölçüldü, beşi de yanlış çıktı.**

| Varsayım                              | Ölçüm                                                | Sonuç                          |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------ |
| Bilgi kutusu satır satır okunabilir   | 1657 `years` alanının **700'ü** aynı satıra sıkışmış | Ayraç sayan gövde ayrıştırması |
| Bitiş yılı olduğu gibi alınır         | Ham hâli %2,7, bir eksiği **%95,4** uyum             | Bitişten bir çıkarılır         |
| Her bağlantı QID'ye çözülür           | Okunan satırların **%51'i** evren dışı               | Eşleştirme tersine çevrildi    |
| Makale metinleri bellekte tutulabilir | 59.000 İngilizce makale ≈ **2,4 GB**                 | Grup grup akıtılır             |
| Alanlar tek tek birleştirilebilir     | **508 dönem** bozuluyor ya da siliniyordu            | Kaydın bütünü gözetilir        |

Sonuncusu en pahalı dersti ve **birim testleriyle görünmüyordu**: iki kulüplük deneme de temizdi. Üç ihlali kazancı ölçmek için kurulan `--skip-wikipedia` karşılaştırması gösterdi — ayıklanan dönem 4'ten 85'e fırlamıştı ve o 81 kaydın hepsi Wikidata'da **sağlam duran**, katmanın bozduğu verilerdi. Dördüncüsü ise yalnızca yükleme sonrası `db:verify` ile ortaya çıktı.

**Uçtan uca doğrulama.** Katmanın var oluş sebebi olan somut şikâyet kapandı: Galatasaray ∩ Konyaspor **38** ortak oyuncu döndürüyor ve Abdülkerim Bardakçı canlı API'de, bilgi kutusuyla birebir aynı verilerle görünüyor (Galatasaray 2022–, 119 maç, 10 gol).

### Faz 4.8 — Oyunun bulduğu dört veri kusuru ✅

**Dördü de kod incelemesiyle değil, OYNANARAK bulundu.** Somut şikâyet şuydu:
"ızgara modunda Yunus Akgün çıkıyor, istatistik modunda bulunamıyor." İki mod
aynı veriyi okuyor; farkı BR-16'nın puanlanabilirlik süzgeci yaratıyordu ve
süzgecin elediği kayıt bozuktu. İzi sürmek üç kusur daha açığa çıkardı.

- [x] **Örtüşme kuralı kanıta yer verir** — kanıtsız bir Wikidata dönemi,
      örtüşen ve maç/gol taşıyan bir Vikipedi kaydına bırakılır (§4.3'ün
      üçüncü eşleşme kademesi). 460 dönem bu yolla kanıtlandı.
- [x] **Küme düşen kulüp evrenden sessizce düşüyordu** — `wdt:P118` kısayolu
      yalnızca _Preferred_ ifadeyi döndürüyor; Adana Demirspor'un lig ifadesi
      artık öncelikli değildi ve kulüp veri kümesinde HİÇ yoktu. Sorgu tüm
      `p:P118` ifadelerini okuyor, yalnızca `DeprecatedRank` eleniyor (§5.3).
- [x] **Kulüp ikizleri birleştirilir** — ayrımı ortak oyuncu eşiği değil
      `P31` SINIFI veriyor; eşik Barcelona'yı yedek takımıyla birleştirirdi
      (§5.3). 49 ikiz birleşti, Roubaix selef/halef çifti ayrı kaldı.
- [x] **Ayrı kalan kulüpler seçicide ayırt edilebilir** — birleştirilmesi
      DOĞRU OLMAYAN çiftler kullanıcıya birebir aynı satırla görünüyordu
      (§5.3). Üç kademe: kısa ad → tam ad → kuruluş yılı.

**Yükleyicide gizli bir varsayım da bu sırada patladı.** İkiz birleştirmesi
bir dönemin KULÜP DEĞİŞTİRMESİNE yol açıyor; ifade kimliği (doğal anahtar)
aynı kalıyor. `load.ts` bunu varsaymıyordu: eski satır gölge kulüpte duruyor,
gölge "dokunulan kulüpler" listesinde olmadığı için silinmiyor ve yazma
`wikidataStatementId` benzersizlik kısıtına takılıyordu. Bayat kulüp temizliği
bunu çözerdi ama yazmadan SONRA çalışıyordu; artık evrenden çıkmış kulüplerin
dönemleri yazmadan ÖNCE siliniyor.

### Faz 4.9 — Kapsam genişletme: 6 → 22 lig ✅

Yayından **önce**, ürün sahibinin kararıyla. Ayrıntı ve ölçümler §1.3'te.

- [x] Aday liglerin QID'i ülke + sınıf üzerinden **ölçülerek** bulundu; üst
      ligin en çok kulüplü lig OLMADIĞI görüldü
- [x] `verifyLabel` alanı: Wikidata sponsorlu adı ("Liga Portugal") taşıyor,
      kullanıcıya gösterilen ad değişmiyor — kimlik denetimi zayıflamadı
- [x] `db:verify` zorunlu kulüp listesine Ajax, Porto, Benfica
- [x] Arayüzdeki kapsam bildirimleri (5 yer) sekiz lige güncellendi
- [x] Kulüp sayısı artık **veriden** okunuyor (`countSelectableClubs`)
- [x] Tam ETL koşusu + `db:verify` KABUL BAŞARILI

**Altıncı kez aynı ders: QID tahmin edilmez.** `db:verify` kapısına eklenecek
üç kulübün QID'i bellekten yazıldı ve **üçü de yanlış çıktı** — canlı sorgu
gösterdi:

| Yazılan   | Beklenen | Gerçekte ne             |
| --------- | -------- | ----------------------- |
| `Q83459`  | Ajax     | Brezilya millî takımı   |
| `Q18656`  | Porto    | Manchester United       |
| `Q127437` | Benfica  | Carl Schurz (bir insan) |

Doğruları (`Q81888`, `Q128446`, `Q131499`) ligin kendi kulüp listesinden
okundu. Bu, §10.1'in "ada/belleğe güvenme" dersinin altıncı tekrarıdır ve bu
kez maliyeti sıfır oldu: kural zaten yerleşik olduğu için QID'ler yazıldıkları
anda doğrulandı.

**Arayüzde elle yazılmış bir sayı da düzeldi.** Kapsam bildirimi "345 kulüp"
diyordu ve kapsam genişletilmeden çok önce eskimişti (gerçek 363). Sayı artık
`DatasetRepository.countSelectableClubs()` ile veriden okunuyor; kullanıcıya
gösterilen kapsam bildirimi yanlış olduğunda güven veren değil güven aşındıran
bir metindir.

**İkinci tur (Avrupa-1): İskoçya, Belçika, Yunanistan, İsviçre.** Ürün sahibi
en temkinli paketi seçti — "gerçek maliyet ölçülsün, sonra devam edilsin".
Karar doğru çıktı: tahmin 67 kulüp / +10 MB idi, gerçek **101 kulüp / +15 MB**
(katı sınıf sayımı gerçeğin ~0,7'si). Aynı oranla dört paketin hepsi alınsaydı
paket ~218 MB'a çıkar ve §10.2'nin "~2 kat marj" ilkesi biterdi.

- [x] Aday ligler ölçüldü; `P3983` ve `P2094` ile OTOMATİK seçim denendi ve
      ikisi de çürüdü (§1.3) — liste küratörlü kaldı
- [x] Dört ligin QID'i + 15 amiral kulüp doğrulandı
- [x] `club-duplicates` sorgusu yığınlandı: 617 kulüpte `HTTP 414`
- [x] `db:verify` zorunlu kulüp listesi 13 → **21**
- [x] Kapsam bildirimleri on iki lige güncellendi

**Ölçek kusuru yayından ÖNCE yakalandı.** `club-duplicates`, tüm kulüp
QID'lerini tek `VALUES` bloğunda gönderiyordu ve 617 kulüpte URL sınırını
aştı. 6 ligde görünmezdi, 8 ligde de görünmedi. Kapsamı yayından önce
genişletmenin somut kazancı budur: sınır, üretimde değil burada patladı.

### Faz 4.10 — Dördüncü oyun modu: "Hangisi daha" ✅

Ürün sahibi §9'un "az mı çok mu" satırını istedi ve mekaniği tarif etti: bir
istatistik seçilir, iki oyuncudan hangisinin daha fazla olduğu sorulur, doğru
cevapta **seçilen oyuncu kalır**, yanlışta koşu biter.

**Mekanik ölçüldü ve bir sömürü buldu.** Kazanan kaldığı için kalan oyuncu her
turda "o ana kadarki en büyük" oluyor; rakip rastgele çekildiğinde hiçbir şey
bilmeden "hep kalanı seç" demek %9,5–13,7 oranında 10+ seri yapıyordu (§9.3).
Mekanik korundu, rakip seçimi dengelendi ve sömürü yazı tura düzeyine indi
(%0,1). Tarif edilen oyun aynen duruyor — değişen tek şey rakibin nereden
çekildiği.

- [x] Havuz ve dağılım ölçüldü: 6.464 tanınır oyuncu, istatistik başına
      3.333–6.464 (BR-31)
- [x] Sömürü ölçüldü ve dengeli rakiple kapatıldı (BR-30)
- [x] Beraberlik ölçüldü; ayırt edilebilirlik bandı kondu (BR-29)
- [x] Değerler cevaptan önce istemciye gönderilmiyor (BR-32)
- [x] §9.3, §6.6 ve BR-28…BR-32 şartnameye yazıldı

### Faz 4.11 — Armalar: kapsam ve lisans

Ürün sahibi armaların Vikipedi'den tamamlanmasını istedi ve gerekçesi doğruydu:
**Vikipedi'deki armalar daha güncel.** Ölçüm gerekçeyi doğruladı ama aynı ölçüm
kullanımı engelledi: güncel resmî logolar Vikipedi'ye **adil kullanım**
gerekçesiyle yükleniyor (%84) ve bu, üçüncü bir siteye yeniden kullanım hakkı
vermiyor (§4.3.1).

**İkinci bulgu istenmemişti ama yayında duruyordu:** mevcut armaların %20'si
CC BY / CC BY-SA ve atıf istiyor; altbilgide yalnızca "Wikidata + Vikipedi"
yazıyordu. §4.3'ün "olgular telife tabi değildir" gerekçesi görselleri
kapsamıyor.

- [x] Arma geçişi (`npm run db:crests`): Vikipedi (5 dil) → Wikidata `P154` → Commons kategorisi
- [x] `NonFree` ve Commons dışı dosyalar reddedilir (BR-33) — 508 aday elendi
- [x] Lisans künyesi veriyle taşınır: `crestLicense`, `crestAuthor`, `crestFilePage`
- [x] Eski 283 armanın künyesi tamamlandı; doğrulanamayan 1 tanesi kaldırıldı
- [x] Akla yatkınlık süzgeci: 28 yanlış arma (stadyum, portre, kupa) kaldırıldı
- [x] `/kaynaklar` atıf sayfası + altbilgi bağlantısı (BR-34)
- [x] `db:verify`: Commons dışı arma 0, künyesi eksik arma 0/413

**Sonuç:** seçilebilir kulüplerde arma **%29,8 → %43,7**; künyesi eksik arma **0**.

### Faz 4.5 — Yayın

Kod tarafı hazır. Kalanlar hesap açmayı ve dağıtımda ölçüm yapmayı gerektirir.

**Sıra önemlidir.** Vercel önce bağlanırsa ilk derleme **kasten** düşer: `dataset:fetch` indireceği sürüm varlığını bulamaz (§3.1). Doğru sıra:

1. [x] GitHub deposu; bu dalın `main`'e birleştirilmesi
2. [x] `ETL_USER_AGENT` depo değişkeni — Wikidata kimliksiz istemcileri engeller
3. [ ] Veri iş akışını **elle bir kez** çalıştır (~2 saat; GitHub'da yerel önbellek yok — Vikipedi katmanıyla birlikte, §4.3)
4. [ ] Vercel projesi: derleme komutu `npm run vercel-build`, `DATASET_URL` ve hız sınırı değişkenleri
5. [ ] Alan adı ve `SITE_URL`

**Dağıtımda ölçülecekler** — hiçbiri yerelde ölçülemez:

- [ ] **`TRUSTED_PROXY_HOPS`** — tek güvenlik etkili bilinmeyen. Yanlış değer hız sınırını ya baypas edilebilir ya da tüm kullanıcıları tek kovaya düşürür hâle getirir. Yöntem `.env.example`'da.
- [ ] CDN önbellek geçersizleştirme (§7.9) — doğrulanınca `s-maxage` uzatılır
- [ ] `process.cwd()` yerleşimi ve `.db` yolu (§3.1)
- [ ] Üretimde CSP nonce ölçümünün tekrarı
- [ ] Gerçek tarayıcıda erişilebilirlik: odak sırası, hedef boyutu, yeniden akış (§7.10)

**Yayına açma anı:** `SITE_INDEXABLE=true` (§7.11). Tek değişken; `robots.txt` ve `noindex` birlikte döner ve bu ÖLÇÜLDÜ — tek derleme çıktısı üç ortam değerinin üçünü de doğru yansıtıyor, yeniden derleme gerekmiyor. Çevirdikten sonra ikisi de doğrulanır:

```
curl -s https://ALAN/robots.txt
curl -s https://ALAN/ | grep -o '<meta name="robots"[^>]*>'
```

### Faz 5 — Genişleme

- [ ] `GameMode` kayıt altyapısının devreye alınması
- [ ] İkinci oyun modu (kariyer bilmecesi)
- [ ] Lig/ülke kapsamının genişletilmesi

### 10.1 Şu Anki Odak

**Faz 4.9 tamamlandı — sıradaki ve TEK kalan Faz 4.5 (yayın).** Üç oyun modu
çalışıyor (ortak oyuncu, 3×3 ızgara, istatistik eşleştirme), sertleştirme
bitti, ikinci kaynak devrede. Kalan iş kod değil: hesap açma ve ilk dağıtımda
beş varsayımın ölçülmesi — bunların yalnızca biri güvenlik etkili
(`TRUSTED_PROXY_HOPS`), kalanı CDN önbellek geçersizleştirme (§7.9),
`process.cwd()` yerleşimi (§3.1), üretimde CSP nonce ölçümü ve gerçek
tarayıcıda yerleşime bağlı erişilebilirlik ölçütleri (§7.10).

Doğrulanabilir taban (Faz 4.9 kapanışı, 2026-08-06):

| Komut                  | Sonuç                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm run typecheck`    | temiz                                                                    |
| `npm run lint`         | temiz (0 uyarı)                                                          |
| `npm run format:check` | temiz                                                                    |
| `npm run test`         | 811/811 geçiyor (birim, bileşen, erişilebilirlik, entegrasyon, doğruluk) |
| `npm run build`        | başarılı; `icon.svg` dışında her rota dinamik (nonce ve §7.11 için)      |
| `npm run audit:ci`     | 0 açık (üretim ağacı)                                                    |
| `npm run etl`          | 992 kulüp · 132.263 oyuncu · **405.418 dönem** (24 lig, §4.3 katmanı)    |
| `npm run db:verify`    | KABUL BAŞARILI — 25 denetim + 44 kulüp örneklemi, tamamı geçiyor         |
| `npm run bench`        | p50 4,5 ms · **p95 16,4 ms** · p99 20,7 ms (bütçe 150 ms)                |
| CSP nonce ölçümü       | **15/15** script eşleşti, 3/3 benzersiz nonce (§7.3)                     |
| Üretimde arma ölçümü   | 12 arma, **12'si** `upload.wikimedia.org`, izinsiz köken **0**           |
| Üretimde önbellek      | `200` → `public, s-maxage=300…` · `400` → `no-store` (§7.9)              |

**Faz 4'ün ölçüm karnesi.** Fazın tamamı aynı biçimde ilerledi: bir varsayım ölçüldü, çoğu yanlış çıktı.

| Varsayım                           | Ölçüm                                                | Sonuç                    |
| ---------------------------------- | ---------------------------------------------------- | ------------------------ |
| `isCurrent` = "hâlâ kulüpte"       | Man Utd'ın "kadrosunda" 1909 doğumlular              | Sözleşmeden çıkarıldı    |
| Sorgu şekli yeterince iyi          | Her istekte 76.358 oyuncu taranıyordu                | p95 47,7 → 16,8 ms       |
| Sunucusuz ⇒ Postgres zorunlu       | Prisma salt-okunur SQLite'ı açıyor, 18,4 ms          | Postgres gereksiz (§3.1) |
| Tarihsiz kayıtlar elenebilir       | Eleme Bill Dale'i de siliyor; Wikidata ayırt etmiyor | BR-8: etiketle, silme    |
| Küçük resim genişliği serbest      | 96 px'de 114 adresin **tamamı** 400 döndü            | 120 px (izinli liste)    |
| `prisma/*.db` kalıbı yeterince dar | Yanına bırakılmış yedek de pakete girdi              | Tek dosya adlandı        |
| `file:` + URL pathname doğru biçim | Windows'ta `file:/C:/…` → "Error code 14"            | Düz dosya yolu           |
| Arayüz kontrastı yeterli           | 5 yerde AA eşiğinin altında                          | Saydamlık tabanı 0,60    |

**Faz 1'in asıl dersi.** Çekim mantığı üç kez üst üste kırıldı ve üçünde de aynı hatayı yaptım: veriden okunabilecek bir şeyi kuralla tahmin ettim. `P831`'in yönü, hangi hataların yeniden denenebilir olduğu, kaç bozuk kaydın kabul edilebilir olduğu — üçü de "şöyle olmalı" diye varsayıldı, sonra ölçümle çürütüldü. Kalıcı düzeltmeler tahmini ölçümle değiştirdi: kulüp seçimi dönem sayısına, yeniden deneme hatanın kaynağına, doğrulama ayıklama oranına bakıyor.

Bunun süreçteki karşılığı `npm run db:verify`. Faz 1 boyunca doğrulama "birkaç kulübe bakıp iyi görünüyor" demekten ibaretti ve üç gerilemeyi kaçırdı. Kontrolün ilk sürümü sonuncusunu ilk koşuda yakaladı.

**Faz 2 aynı dersin dördüncü tekrarını gösterdi.** Altın veri seti kurulurken `name contains "Shevchenko"` boş döndü; kayıt Türkçe etiketiyle "Andriy Şevçenko" olarak duruyordu. Ada güvenmenin bedeli bu kez bir gerileme değil, sahte bir "veri eksik" teşhisi oldu. Kural artık kod tabanında üç ayrı yerde uygulanıyor: `db:verify`, altın veri seti ve entegrasyon testleri kimliği **QID ile** sabitler.

### 10.2 Bilinen Teknik Borç / İleri Kararlar

| Konu                                      | Şimdiki karar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Ne zaman değişir                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| SQLite                                    | Salt-okunur derleme çıktısı (§3.1); ölçüldü, yazma yolu yok                                                                                                                                                                                                                                                                                                                                                                                                                                            | Skor tablosu yazma getirdiğinde — ayrı veri kümesi olarak                                                              |
| Fonksiyon paketi ~209 MB                  | **Yeniden ölçüldü (24 lig):** sınır 250 MB, marj **1,19 kat**. Veri 161,4 MB, Prisma motoru ~43 MB. Sıkıştırma valfi ARTIK KURULUP TARTILDI: yalnızca ETL sütunu düşürülünce 109,8 MB, tamsayı birincil anahtarla birlikte **34,8 MB** (%78 küçülme, kayıpsız; §3.1)                                                                                                                                                                                                                                   | Sınıra yaklaşılırsa uygulanır. Şimdi yapılmadı: ölçüm bir arıza göstermiyor ve yayın öncesi şema göçü karşılıksız risk |
| Derlemede NFT uyarısı                     | Kabul — `resolveDatabaseUrl` içindeki `path.resolve` tetikliyor; iz ÖLÇÜLDÜ, şişme yok (280 dosya)                                                                                                                                                                                                                                                                                                                                                                                                     | Turbopack daha dar analiz sunarsa                                                                                      |
| Bellek içi hız sınırlama                  | Sunucusuzda örnek başına çalışır; katmanlardan biri, tek savunma değil (§7.5)                                                                                                                                                                                                                                                                                                                                                                                                                          | Skor tablosu geldiğinde paylaşımlı sayaç **zorunlu** olur                                                              |
| Wikidata tek kaynak                       | **Çözüldü (Faz 4.7):** Vikipedi ikinci kaynak olarak devrede, 5 dil; elle düzeltme kaldırıldı (§4.3)                                                                                                                                                                                                                                                                                                                                                                                                   | Kadro keşfi ayrı bir borç olarak aşağıda                                                                               |
| Gençlerbirliği ikizi (yukarı akış)        | **ERTELENDİ — kullanıcı kararı (9 Ağustos 2026).** Boru hattı tarafı bitti; kalan iş Wikidata'da iki İFADE EKLEMEK: `Q20473364 P361 Q641373` (öğenin kendi açıklaması zaten bunu yazıyor) ve `Q641373 P31 += Q13580678` (kanıt: `Q19611326` kadın voleybol takımı `P127` ile bu kulübe ait). İkisi de ekleme, hiçbir şey silinmiyor. Yapılmadı: dışa dönük, kalıcı ve herkese açık bir düzenleme ve 906 kulüpten birinin listede çift görünmesi kabul edildi — BR-36 uyarısı kullanıcıyı zaten koruyor | Yayın sonrası, ya da kulüp seçicide karışıklık bildirilirse. Araştırma tamam: yeniden ölçüm gerekmez                   |
| i18n                                      | Yalnızca TR metinler                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | İngilizce talep edilirse (yapı hazır)                                                                                  |
| Tümüyle dinamik render                    | Nonce'lu CSP için kabul edildi (§7.3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Next kararlı SRI sunarsa statik + hash tabanlı CSP'ye geçilir                                                          |
| `brace-expansion` açığı                   | Dev-only, izleniyor (§7.7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `eslint-config-next` eslint 10 uyumlu eklentilerle çıkarsa                                                             |
| Yalnızca erkek ligleri                    | Kapsam kararı (BR-7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Kadın futbolu kendi lig kümesiyle ayrı kapsam olarak eklenebilir                                                       |
| Kulüp sınıfı beyaz listesi                | 6 sınıf, ölçülerek belirlendi                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Yeni bir kulüp farklı `P31` ile listeden düşerse genişletilir                                                          |
| Tam kariyer verisi yok                    | Faz 1 kapsam sınırı (§1.3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Kariyer bilmecesi / bağlantı zinciri modları için gerekli olacak                                                       |
| `isYouth` hiç tetiklenmiyor               | Kabul — veri kümesinde altyapı takımı yok (383 kulübün 0'ı)                                                                                                                                                                                                                                                                                                                                                                                                                                            | Alt lig kapsamı eklenirse altyapı/rezerv takımlar girer, BR-2 devreye girer                                            |
| Kulüp kuruluş yılı gürültülü              | Uyarı, bloklamıyor (§8.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 10.166 dönem kulüp kuruluşundan önce; `P571` sık sık selef kulübü gösteriyor                                           |
| `db:verify` elle çalışır                  | Faz 1'de yeterli                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Dağıtım ardışık düzenine girince veri yükleme adımının parçası olur                                                    |
| Tarihsiz dönemler yanlış pozitif üretiyor | **Çözüldü (Faz 4):** elenmiyor, BR-8 ile etiketleniyor; oran `db:verify`'da tavanlı                                                                                                                                                                                                                                                                                                                                                                                                                    | İkinci bir veri kaynağı eklenirse kayıtlar teker teker doğrulanabilir hâle gelir                                       |
| Ortak oyuncu sayısı sınırsız              | Kabul — yeniden ölçüldü: en büyük **377**, 500'ü aşan çift **0** (§10.2 notu)                                                                                                                                                                                                                                                                                                                                                                                                                          | Sayfalama, arayüz gerektirdiğinde veya sonuç 500'ü aştığında                                                           |
| Altın veri seti elle bakımlı              | 31 olgu, elle doğrulandı                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Kapsam genişledikçe büyütülür; otomatik türetme yapılMAZ (kendini doğrular)                                            |
| Kulüp armaları gösterilmiyor              | **Çözüldü (Faz 4):** ETL normalize ediyor, `ClubCrest` gösteriyor; 114/114 izinli kökende                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                                                      |
| `P154` bazı kulüplerde arma DEĞİL         | Kabul — ölçüldü: Barcelona'nın değeri tesis fotoğrafı, Middlesbrough'nunki sokak fotoğrafı                                                                                                                                                                                                                                                                                                                                                                                                             | İkinci kaynak (Vikipedi) armaları da taşırsa                                                                           |
| CDN önbellek geçersizleştirme             | Varsayım; bu yüzden `s-maxage` temkinli (300 sn) tutuluyor (§7.9)                                                                                                                                                                                                                                                                                                                                                                                                                                      | Faz 4.5'te ölçülür; doğrulanırsa süre uzatılır                                                                         |
| p95 gecikme                               | **Ölçüldü (Faz 4):** 16,8 ms, bütçe 150 ms; `npm run bench` kalıcı kapı                                                                                                                                                                                                                                                                                                                                                                                                                                | Kapsam genişleyince yeniden ölçülür (betik zaten var)                                                                  |
| Erişilebilirlik: yerleşime bağlı ölçütler | Yapısal denetim (axe-core) ve kontrast ölçüldü; görünürlük, odak sırası ve hedef boyutu ölçülMEDİ (§7.10)                                                                                                                                                                                                                                                                                                                                                                                              | Faz 4.5: gerçek tarayıcıda elle denetim                                                                                |
| Bağsız kulüp ikizi (Gençlerbirliği)       | Kabul — ölçüldü, eşik tabanlı kural GÜVENLİ DEĞİL: %80 eşiği Barcelona'yı yedek takımıyla birleştirirdi (§5.3)                                                                                                                                                                                                                                                                                                                                                                                         | Doğru düzeltme yeri kaynağın kendisi: Wikidata'da iki öğenin birleştirilmesi                                           |
| Kadro keşfi: güncel kadro %26 eksik       | Kabul — yapısal; oyuncu evrenini `P54` tanımlıyor, bağı olmayan oyuncuya Vikipedi katmanı da ULAŞAMIYOR (§4.7)                                                                                                                                                                                                                                                                                                                                                                                         | Kadro şablonlarından oyuncu keşfi ayrı bir çekim katmanı olarak yazılırsa                                              |
| Kaleci golleri kaynakta kirli             | Kabul — Vikipedi YENEN golü negatif yazıyor (`-87`), bu değerler Wikidata'ya pozitif gol olarak girmiş olabiliyor (Ottavio Bugatti 256 maç / 329 "gol"). BR-22 mutabakatı bunları düşürüyor ama kaynağı temizlemiyor                                                                                                                                                                                                                                                                                   | Kaleci dönemleri ayrı bir alanla (yenen gol) modellenirse; şu an oyunun hiçbir ekseni kaleci golü sormuyor             |
| Izgara havuzu 18 ligi kapsamıyor          | **Kısmen ödendi (2026-08-07):** "Sen kur" turunda kullanıcı 906 kulübün hepsini kullanabiliyor (BR-25); günlük ızgara ertelenmiş kararla 82 kulüpte kaldı — Ajax/Porto/Benfica, LA Galaxy ve Al-Hilal ızgarada ve günün oyuncusu havuzunda YOK (§9.1)                                                                                                                                                                                                                                                  | Ürün sahibi yeni lig kulüplerini görüp seçtiğinde; ölçüm değil KARAR                                                   |

**En büyük ortak oyuncu sonucu yeniden ölçüldü ve ölçüm bir şey daha söyledi.**
Faz 3'te kaydedilen 128 değeri eskimişti; 363 seçilebilir kulübün tüm çiftleri
tarandığında sıralamanın başı şöyle:

| Ortak | Çift                                            | Gerçekte ne            |
| ----- | ----------------------------------------------- | ---------------------- |
| 377   | Gençlerbirliği / Gençlerbirliği (futbol takımı) | **bağsız ikiz** (§5.3) |
| 220   | Ancona / A.C. Ancona                            | yeniden kurulmuş kulüp |
| 186   | LR Vicenza / Vicenza                            | ad değişikliği         |
| 174   | RCD Espanyol / Barcelona                        | gerçek futbol olgusu   |
| 142   | Genoa CFC / Torino                              | gerçek futbol olgusu   |

İlk üç sıra futbolla ilgili değil: aynı kulübün iki kaydı. Bu, kapatılmayan
ikiz boşluğunun kullanıcıya ne kadara mal olduğunun sayısal karşılığıdır —
oyuncu, Gençlerbirliği'nin iki kaydını seçtiğinde 377 "ortak oyuncu" görüyor.
Sayfalama kararı değişmedi: 500'ü aşan çift **0**.

---

## 11. Sözlük

| Terim         | Anlam                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| **Spell**     | Bir oyuncunun bir kulüpteki tek bir dönemi (dönüşler ayrı Spell'dir)        |
| **ETL**       | Extract–Transform–Load; veriyi çek, dönüştür, yükle                         |
| **Port**      | `application` katmanının tanımladığı, `infrastructure`'ın uyguladığı arayüz |
| **DTO**       | Data Transfer Object; API'nin dışarı döndüğü açıkça tanımlı veri şekli      |
| **SPARQL**    | Wikidata'nın sorgu dili                                                     |
| **Altın set** | Elle doğrulanmış, testlerde referans alınan veri kümesi                     |

---

## 12. Belge Bakımı

Bu belge kodla birlikte yaşar. Aşağıdaki durumlarda **kod yazmadan önce** güncellenir:

- yeni bir bağımlılık eklendiğinde (§3),
- veri modeli değiştiğinde (§5),
- API sözleşmesi değiştiğinde (§6),
- yeni bir güvenlik kararı alındığında (§7),
- bir faz tamamlandığında (§10 — kutucuk işaretlenir).
