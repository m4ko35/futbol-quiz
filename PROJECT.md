# Futbol Quiz — Proje Şartnamesi

> Bu belge projenin tek referans kaynağıdır (single source of truth).
> Kod ile belge çeliştiğinde önce bu belge güncellenir, sonra kod yazılır.

**Sürüm:** 0.1.0
**Tarih:** 2026-07-30
**Durum:** Faz 4 tamamlandı — proje eksiksiz ve sertleştirilmiş. Sıradaki Faz 4.5: yayın.

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

Avrupa'nın 5 büyük ligi + Süper Lig:

| Lig            | Ülke      | Wikidata QID | Güncel kadro | Veri kümesi | Seçilebilir |
| -------------- | --------- | ------------ | ------------ | ----------- | ----------- |
| Premier League | İngiltere | `Q9448`      | 20           | 51          | 51          |
| La Liga        | İspanya   | `Q324867`    | 21           | 61          | 57          |
| Serie A        | İtalya    | `Q15804`     | 28           | 92          | 81          |
| Bundesliga     | Almanya   | `Q82595`     | 18           | 76          | 59          |
| Ligue 1        | Fransa    | `Q13394`     | 22           | 75          | 68          |
| Süper Lig      | Türkiye   | `Q485568`    | 20           | 33          | 29          |
|                |           | **Toplam**   | **129**      | **388**     | **345**     |

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
│   ├── sources/wikidata/
│   │   ├── client.ts              ← rate-limit + retry + User-Agent + önbellek
│   │   ├── queries.ts             ← parametreli SPARQL kurucuları (QID guard'lı)
│   │   └── schemas.ts             ← gelen yanıtın Zod şeması + okuyucular
│   ├── pipeline/
│   │   ├── extract.ts             ← üç geçişli çekim orkestrasyonu
│   │   ├── normalize.ts           ← ad/tarih normalizasyonu, dedupe
│   │   ├── validate.ts            ← tutarlılık denetimleri
│   │   └── load.ts                ← veritabanına upsert
│   ├── overrides/                 ← elle düzeltmeler (JSON, versiyonlanır)
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
  isSelectable Boolean @default(false) // MVP seçim listesinde görünür mü
  leagueId    String?
  league      League? @relation(fields: [leagueId], references: [id])
  spells      Spell[]

  @@index([searchKey])
  @@index([isSelectable])
}

model Player {
  id          String  @id @default(cuid())
  wikidataId  String  @unique
  name        String
  searchKey   String
  birthDate   DateTime?
  nationality String?                 // ISO 3166-1 alpha-2
  position    String?                 // normalize edilmiş enum metni
  spells      Spell[]

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
| `link`    | `clubsByLeagueLink`      | `P118` ile lige bağlı kulüpler                                                      |
| `seasons` | `clubsFromSeasons`       | `P118` eksik; Wolfsburg, St. Pauli, Heidenheim yalnızca `P3450`/`P1923` ile geliyor |
| `parents` | `clubsFromSeasonParents` | `P1923` bazen sezona özgü takım varlığı döndürür; gerçek kulüp `P831` ucunda        |

**`P831`'in yönü Wikidata'da tutarsızdır** ve hangi ucun gerçek kulüp olduğu türden okunamaz. Ölçüm:

| Tohum                         | `P831` hedefi              | Oyuncu (tohum → hedef) |
| ----------------------------- | -------------------------- | ---------------------- |
| `Q97905916` FC Augsburg 25-26 | `Q15755` FC Augsburg       | 0 → **326**            |
| `Q7156` FC Barcelona          | `Q3091261` FC Barcelona    | **1399** → 22          |
| `Q43710` Antalyaspor          | `Q12808521` Antalyaspor K. | **277** → 7            |

İlk satır çözümlemeyi gerektirir, diğer ikisi çözümlemeden zarar görür. Bu yüzden `P831` bir **çözümleme** (tohumun yerine ebeveyni koymak) olarak değil, **ek aday** olarak kullanılır: üç dal da yalnızca aday üretir.

Kararı tahmin değil ölçüm verir: her aday için dönemler çekilir, `MIN_SPELLS_FOR_SELECTABLE` (50) eşiğinin altındakiler seçilemez işaretlenir, hiç dönemi olmayanlar yükleme sonunda silinir. Böylece "gerçek kulüp hangisi" sorusunu, cevabı zaten ölçtüğümüz büyüklük — kulübe bağlı `P54` ifadesi sayısı — yanıtlar.

Bu tasarım üç kez sırayla kırılan üç ayrı kuralın yerine geçti: önce çözümleme hiç yoktu (Augsburg 0 dönemle girdi), sonra her kulübe uygulandı (Barcelona ve Antalyaspor kabuk varlığa taşındı), sonra yalnızca sezon dalına uygulandı (Antalyaspor yine bozuldu, çünkü `P1923` katılımcısı her zaman sezon varlığı değil). Ortak hata, veriden okunabilecek bir şeyi kuralla tahmin etmekti.

### 5.4 İş Kuralları

Bunlar `domain/services/` içinde saf fonksiyon olarak yaşar ve birim testi ile korunur:

- **BR-1 — Ortak oyuncu tanımı:** Bir oyuncu, A kulübünde en az bir `Spell` ve B kulübünde en az bir `Spell` kaydına sahipse ortaktır. Dönemlerin zaman olarak örtüşmesi _gerekmez_ (zaten aynı anda iki kulüpte olamaz).
- **BR-2 — Altyapı dönemi:** `isYouth = true` olan dönemler varsayılan olarak **sayılmaz**. Kullanıcı "altyapıyı da dahil et" seçeneğiyle açabilir.
- **BR-3 — Kiralık:** Kiralık dönemler varsayılan olarak **sayılır**, fakat listede açıkça "kiralık" rozetiyle işaretlenir.
- **BR-4 — Aynı kulüp seçimi:** A ile B aynı kulüp ise istek reddedilir (`400`).
- **BR-5 — Sıralama:** Sonuçlar, iki kulüpteki toplam maç sayısına göre azalan; maç bilgisi yoksa en son dönem yılına göre azalan sıralanır.
- **BR-6 — Tarih normalizasyonu:** Wikidata'nın gün hassasiyetli tarihleri sezon yılına indirgenir (Temmuz–Aralık → o yıl; Ocak–Haziran → bir önceki yıl sezonuna ait).
- **BR-7 — Kapsam: erkek ligleri.** Veri kümesi hedeflenen altı erkek ligiyle sınırlıdır. Wikidata kadın takımı dönemlerini çoğu zaman **aynı kulüp varlığına** bağladığı için ayrım kulüp düzeyinde yapılamıyor; `P21` (cinsiyet) alanı yalnızca bu kapsamı uygulamak üzere okunur, veritabanına yazılmaz ve arayüzde gösterilmez. `P21` kaydı olmayan oyuncular **kapsamda kalır** — eksik meta veri dışlama gerekçesi değildir. Kadın futbolu ileride kendi lig kümesiyle ayrı bir kapsam olarak eklenebilir (§10.2).
- **BR-8 — Kanıt düzeyi.** Bir `Spell`, `startYear`, `endYear`, `appearances` ve `goals` alanlarının **dördü de** boşsa **kanıtsızdır**; en az biri doluysa kanıtlıdır. Kanıtsız dönemler BR-1 kapsamında **sayılır** (elenmez), fakat API yanıtında ve arayüzde açıkça işaretlenir. Gerekçe ve ölçüm §1.4'tedir; özeti: eleme, uydurma kayıtlarla birlikte doğru kayıtları da siliyor ve Wikidata ikisini ayıracak bir sinyal taşımıyor. BR-5'in sıralaması bu dönemleri kendiliğinden en sona koyar (ne maç sayısı ne yıl bilgisi vardır), dolayısıyla ayrı bir sıralama kuralı gerekmez.

---

## 6. API Sözleşmesi

Tüm uçlar `Content-Type: application/json` döner. Hata gövdesi tek biçimlidir.

### 6.1 `GET /api/clubs`

Kulüp arama / otomatik tamamlama.

| Parametre | Tip    | Zorunlu | Kural                   |
| --------- | ------ | ------- | ----------------------- |
| `q`       | string | hayır   | 1–50 karakter, kırpılır |
| `limit`   | int    | hayır   | 1–50, varsayılan 20     |

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
    "players": [
      {
        "id": "…",
        "name": "Emmanuel Eboué",
        "nationality": "CI",
        "position": "Defender",
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

**`isCurrent` neden yok.** Faz 1 şemasında bu alan vardı ve "oyuncu hâlâ kulüpte" diye okunuyordu. Faz 4'te ölçüldü: alan gerçekte "Wikidata'da bitiş tarihi girilmemiş" demek. Man United'ın "güncel kadrosunda" Herbert Broomfield (1909) ve Harold Hardman (1912), Bayern'inkinde Paul Francke (1899) çıkıyor; 32.102 dönemde bitiş tarihi eksik. Yanlış olduğu **bilinen** bir alanı sözleşmede tutmak, onu tüketen herkes için tuzaktır — alan sözleşmeden çıkarıldı. Ham değer veritabanında duruyor (ileride güvenilir bir kaynakla düzeltilebilir), ama dışarı verilmiyor. Bitişi bilinmeyen dönem arayüzde `2011 – ?` olarak gösterilir.

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

**2. Kontrast — elle hesaplandı.** jsdom'un yerleşim motoru olmadığı için `color-contrast` kuralı orada çalışamaz; açık bırakılsaydı "geçti" derdi ve bu yanıltıcı olurdu. Kural bilerek kapatıldı, kontrast ayrıca hesaplandı. Renkler `#171717`/`#ffffff` (açık) ve `#ededed`/`#0a0a0a` (koyu); arayüz tonları `currentColor` üzerine saydamlıkla kuruluyor, yani her saydamlık değeri bir kontrast oranına karşılık geliyor:

| Saydamlık | Açık mod | Koyu mod | Normal metin (4,5) | Arayüz/odak (3,0) |
| --------- | -------- | -------- | ------------------ | ----------------- |
| 0,70      | 6,58     | 8,42     | ✅                 | ✅                |
| 0,60      | 4,67     | 6,36     | ✅                 | ✅                |
| 0,50      | 3,41     | 4,74     | ❌ açık modda      | ✅                |
| 0,30      | 1,96     | 2,38     | ❌                 | ❌                |
| 0,20      | 1,53     | 1,66     | ❌                 | ❌                |

Ölçüm beş ihlal buldu ve beşi de düzeltildi:

| Yer                                | Neydi                      | Ne oldu           | Hangi ölçüt            |
| ---------------------------------- | -------------------------- | ----------------- | ---------------------- |
| Arama kutusu kenarlığı             | `border-current/20` (1,53) | `/50`             | 1.4.11 arayüz bileşeni |
| Arama kutusu odak halkası          | `ring-current/20` (1,53)   | `/60`             | 1.4.11 / 2.4.11 odak   |
| "Değiştir" ve "Yeniden dene" odağı | `ring-current/30` (1,96)   | `/60`             | 1.4.11 / 2.4.11 odak   |
| Hata kimliği metni                 | `opacity-50` (3,41)        | `/70`             | 1.4.3 metin kontrastı  |
| Boş sonuç açıklaması               | `opacity-50` + `text-xs`   | `/70` + `text-sm` | 1.4.3                  |

**Kural: metin için asgari saydamlık 0,60.** Bunun altındaki her değer açık modda AA'yı karşılamıyor.

**Renk tek gösterge değildir (1.4.1).** BR-8'in kanıtsız dönem işareti kesik çizgiyle _ve_ metinle veriliyor ("kaynakta ayrıntı yok"); kiralık dönem rozeti de metin taşıyor. Biçimi ayırt edemeyen kullanıcı için bilgi kaybolmuyor.

**Armalar süslemedir (1.1.1).** `alt=""` ve `aria-hidden` taşırlar; yanlarındaki kulüp adı zaten okunuyor, "Galatasaray arması" demek aynı bilgiyi ikinci kez seslendirmek olurdu.

**Bu denetimin DIŞINDA kalanlar — dürüstçe.** jsdom yerleşim hesaplamadığı için görünürlük, gerçek odak sırası, hedef boyutu (2.5.5) ve yeniden akış (1.4.10) ölçülmedi. Bunlar gerçek tarayıcı gerektirir ve ilk dağıtımdan sonra elle denetlenecektir (Faz 4.5).

### 7.11 Site Kimliği ve İndeksleme

**İndeksleme tek anahtarla yönetilir:** `SITE_INDEXABLE`. Hem `app/robots.ts` hem sayfa meta etiketi aynı değeri okur. İki ayrı yerde tutulsaydı biri açılıp diğeri kapalı kalabilir ve sonuç aylarca fark edilmeden yanlış olurdu.

**Varsayılan `false`.** Unutulan bir yapılandırma siteyi sessizce arama sonuçlarına sokmamalı; tersi zararsızdır. Değer `"true"`/`"false"` dizgisiyle sınırlı — `z.coerce.boolean()` KULLANILMAZ, çünkü o dönüşüm boş olmayan her dizgiyi `true` yapar ve `"false"` da `true` olurdu. Tanınmayan bir değerde uygulama başlamaz (§7.6).

**Neden hem `robots.txt` hem `noindex`.** `robots.txt` yalnızca **taramayı** engeller, indekslemeyi değil: dışarıdan bağlantı verilmiş bir adres, içeriği hiç okunmadan arama sonuçlarında görünebilir. İndekslemeyi asıl engelleyen `noindex` meta etiketidir. Bu aşamada siteye dışarıdan bağlantı olmadığı için ikisi birlikte kullanılıyor; tarama trafiğini baştan kesmenin de maliyeti yok.

**Doğrulanmış çıktı (üretim derlemesi, `SITE_INDEXABLE` tanımsız):**

```
robots.txt        User-Agent: *  /  Disallow: /
<meta name="robots" content="noindex, nofollow, nocache">
```

**Paylaşım meta verisi.** `metadataBase` olmadan Open Graph alanları göreli kalır ve hiçbir sohbet uygulaması onları çözemez; bağlantı başlıksız gri bir kutu olarak görünür. `SITE_URL` bu tabanı verir.

> **Görsel üretilmiyor.** `twitter:card` bilerek `summary` (görselli `summary_large_image` değil): olmayan bir görseli vaat etmek boş bir kart üretir. Üretilmiş bir paylaşım görseli (`opengraph-image`) istenirse eklenebilir; MVP için gerekli görülmedi.

**Diğer.** 404 sayfası Türkçedir (arayüz dili TR — §1.2) ve denenen adresi **yansıtmaz**: adresi sayfaya basmak, kullanıcı girdisini sayfaya basmanın en kolay yoludur ve buna hiçbir sebep yok (§6.3). Simge, iskeletten kalan Next logosu yerine uygulamanın kendi işaretidir — iki kesişen çember, yani `A ∩ B`.

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

| Mod                    | Açıklama                                              | Ek veri ihtiyacı    |
| ---------------------- | ----------------------------------------------------- | ------------------- |
| **Ortak oyuncu** (MVP) | İki kulüpte de oynamış oyuncular                      | —                   |
| Kariyer bilmecesi      | Kulüp geçmişi verilir, oyuncu tahmin edilir           | —                   |
| 3×3 ızgara             | Satır/sütun kriterlerini sağlayan oyuncu bulma        | Ülke, kupa, dönem   |
| Bağlantı zinciri       | İki oyuncu arasında ortak kulüp üzerinden en kısa yol | Graf sorgusu (BFS)  |
| Az mı çok mu           | Maç/gol sayısı karşılaştırması                        | İstatistik alanları |

Bu modlar mevcut `Spell` modelini kullanır; yeni tablo değil, yeni **alan** gerektirirler. Şema bu genişlemeye göre tasarlandı (§5.2'deki `appearances`, `goals`, `nationality` alanları şimdiden mevcut).

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

### Faz 4.5 — Yayın

Kod tarafı hazır. Kalanlar hesap açmayı ve dağıtımda ölçüm yapmayı gerektirir.

**Sıra önemlidir.** Vercel önce bağlanırsa ilk derleme **kasten** düşer: `dataset:fetch` indireceği sürüm varlığını bulamaz (§3.1). Doğru sıra:

1. [ ] GitHub deposu; bu dalın `main`'e birleştirilmesi
2. [ ] `ETL_USER_AGENT` depo değişkeni — Wikidata kimliksiz istemcileri engeller
3. [ ] Veri iş akışını **elle bir kez** çalıştır (~1 saat; GitHub'da yerel önbellek yok)
4. [ ] Vercel projesi: derleme komutu `npm run vercel-build`, `DATASET_URL` ve hız sınırı değişkenleri
5. [ ] Alan adı ve `SITE_URL`

**Dağıtımda ölçülecekler** — hiçbiri yerelde ölçülemez:

- [ ] **`TRUSTED_PROXY_HOPS`** — tek güvenlik etkili bilinmeyen. Yanlış değer hız sınırını ya baypas edilebilir ya da tüm kullanıcıları tek kovaya düşürür hâle getirir. Yöntem `.env.example`'da.
- [ ] CDN önbellek geçersizleştirme (§7.9) — doğrulanınca `s-maxage` uzatılır
- [ ] `process.cwd()` yerleşimi ve `.db` yolu (§3.1)
- [ ] Üretimde CSP nonce ölçümünün tekrarı
- [ ] Gerçek tarayıcıda erişilebilirlik: odak sırası, hedef boyutu, yeniden akış (§7.10)

**Yayına açma anı:** `SITE_INDEXABLE=true` (§7.11). Tek değişken; `robots.txt` ve `noindex` birlikte döner.

### Faz 5 — Genişleme

- [ ] `GameMode` kayıt altyapısının devreye alınması
- [ ] İkinci oyun modu (kariyer bilmecesi)
- [ ] Lig/ülke kapsamının genişletilmesi

### 10.1 Şu Anki Odak

**Faz 4 tamamlandı — sıradaki Faz 4.5 (yayın).** Sertleştirme bitti; proje eksiksiz. Kalan iş kod değil: hesap açma ve ilk dağıtımda üç varsayımın ölçülmesi — CDN önbellek geçersizleştirme (§7.9), `process.cwd()` yerleşimi (§3.1) ve gerçek tarayıcıda yerleşime bağlı erişilebilirlik ölçütleri (§7.10).

Doğrulanabilir taban (Faz 4 kapanışı, 2026-07-30):

| Komut                  | Sonuç                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm run typecheck`    | temiz                                                                    |
| `npm run lint`         | temiz (0 uyarı)                                                          |
| `npm run format:check` | temiz                                                                    |
| `npm run test`         | 361/361 geçiyor (birim, bileşen, erişilebilirlik, entegrasyon, doğruluk) |
| `npm run build`        | başarılı, tüm rotalar dinamik (nonce için gerekli)                       |
| `npm run audit:ci`     | 0 açık (üretim ağacı)                                                    |
| `npm run etl`          | 388 kulüp · 76.358 oyuncu · 193.003 dönem                                |
| `npm run db:verify`    | 19/19 kontrol geçiyor (kanıt oranı dâhil)                                |
| `npm run bench`        | p50 4,2 ms · **p95 16,8 ms** · p99 21,0 ms (bütçe 150 ms)                |
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

| Konu                                      | Şimdiki karar                                                                                             | Ne zaman değişir                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| SQLite                                    | Salt-okunur derleme çıktısı (§3.1); ölçüldü, yazma yolu yok                                               | Skor tablosu yazma getirdiğinde — ayrı veri kümesi olarak                        |
| Fonksiyon paketi 125,4 MB                 | Ölçüldü; sınır 250 MB, marj ~2 kat. Veri %62, Prisma motoru %34 (§3.1)                                    | Sınıra yaklaşılırsa ETL'e özgü sütun + indeks düşürülür (~20 MB)                 |
| Derlemede NFT uyarısı                     | Kabul — `resolveDatabaseUrl` içindeki `path.resolve` tetikliyor; iz ÖLÇÜLDÜ, şişme yok (280 dosya)        | Turbopack daha dar analiz sunarsa                                                |
| Bellek içi hız sınırlama                  | Sunucusuzda örnek başına çalışır; katmanlardan biri, tek savunma değil (§7.5)                             | Skor tablosu geldiğinde paylaşımlı sayaç **zorunlu** olur                        |
| Wikidata tek kaynak                       | Kabul, override'larla                                                                                     | Kapsam boşlukları %5'i aşarsa ikinci kaynak eklenir                              |
| i18n                                      | Yalnızca TR metinler                                                                                      | İngilizce talep edilirse (yapı hazır)                                            |
| Tümüyle dinamik render                    | Nonce'lu CSP için kabul edildi (§7.3)                                                                     | Next kararlı SRI sunarsa statik + hash tabanlı CSP'ye geçilir                    |
| `brace-expansion` açığı                   | Dev-only, izleniyor (§7.7)                                                                                | `eslint-config-next` eslint 10 uyumlu eklentilerle çıkarsa                       |
| Yalnızca erkek ligleri                    | Kapsam kararı (BR-7)                                                                                      | Kadın futbolu kendi lig kümesiyle ayrı kapsam olarak eklenebilir                 |
| Kulüp sınıfı beyaz listesi                | 6 sınıf, ölçülerek belirlendi                                                                             | Yeni bir kulüp farklı `P31` ile listeden düşerse genişletilir                    |
| Tam kariyer verisi yok                    | Faz 1 kapsam sınırı (§1.3)                                                                                | Kariyer bilmecesi / bağlantı zinciri modları için gerekli olacak                 |
| `isYouth` hiç tetiklenmiyor               | Kabul — veri kümesinde altyapı takımı yok (388 kulübün 0'ı)                                               | Alt lig kapsamı eklenirse altyapı/rezerv takımlar girer, BR-2 devreye girer      |
| Kulüp kuruluş yılı gürültülü              | Uyarı, bloklamıyor (§8.2)                                                                                 | 9158 dönem kulüp kuruluşundan önce; `P571` sık sık selef kulübü gösteriyor       |
| `db:verify` elle çalışır                  | Faz 1'de yeterli                                                                                          | Dağıtım ardışık düzenine girince veri yükleme adımının parçası olur              |
| Tarihsiz dönemler yanlış pozitif üretiyor | **Çözüldü (Faz 4):** elenmiyor, BR-8 ile etiketleniyor; oran `db:verify`'da tavanlı                       | İkinci bir veri kaynağı eklenirse kayıtlar teker teker doğrulanabilir hâle gelir |
| Ortak oyuncu sayısı sınırsız              | Kabul — ölçülen en büyük sonuç 128 oyuncu                                                                 | Sayfalama, arayüz gerektirdiğinde (Faz 3) veya sonuç 500'ü aştığında             |
| Altın veri seti elle bakımlı              | 31 olgu, elle doğrulandı                                                                                  | Kapsam genişledikçe büyütülür; otomatik türetme yapılMAZ (kendini doğrular)      |
| Kulüp armaları gösterilmiyor              | **Çözüldü (Faz 4):** ETL normalize ediyor, `ClubCrest` gösteriyor; 114/114 izinli kökende                 | —                                                                                |
| `P154` bazı kulüplerde arma DEĞİL         | Kabul — ölçüldü: Barcelona'nın değeri tesis fotoğrafı, Middlesbrough'nunki sokak fotoğrafı                | İkinci kaynak veya elle override listesi eklenirse                               |
| CDN önbellek geçersizleştirme             | Varsayım; bu yüzden `s-maxage` temkinli (300 sn) tutuluyor (§7.9)                                         | Faz 4.5'te ölçülür; doğrulanırsa süre uzatılır                                   |
| p95 gecikme                               | **Ölçüldü (Faz 4):** 16,8 ms, bütçe 150 ms; `npm run bench` kalıcı kapı                                   | Kapsam genişleyince yeniden ölçülür (betik zaten var)                            |
| Erişilebilirlik: yerleşime bağlı ölçütler | Yapısal denetim (axe-core) ve kontrast ölçüldü; görünürlük, odak sırası ve hedef boyutu ölçülMEDİ (§7.10) | Faz 4.5: gerçek tarayıcıda elle denetim                                          |

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
