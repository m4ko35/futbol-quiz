# Futbol Quiz

İki futbol kulübü seçin, **ikisinde de forma giymiş** oyuncuları görün.

Bu depo, ileride başka oyun modlarını da (kariyer bilmecesi, 3×3 ızgara,
bağlantı zinciri) taşıyacak şekilde katmanlı bir mimariyle kuruldu.

> **Tasarım, kapsam ve güvenlik kararlarının tamamı [PROJECT.md](./PROJECT.md)
> dosyasındadır.** Kod ile belge çelişirse önce belge güncellenir. Katkı
> vermeden önce en azından §2 (Mühendislik İlkeleri) ve §7 (Güvenlik) okunmalı.

## Gereksinimler

- **Node.js ≥ 20.11** (geliştirme `v24` ile yapıldı)
- npm 10+

Veritabanı SQLite olduğu için ayrıca sunucu kurmanız gerekmez.

## Kurulum

```bash
npm ci                  # package-lock.json'a birebir sadık kurulum
cp .env.example .env    # Windows PowerShell: Copy-Item .env.example .env
```

`.env` içindeki `ETL_USER_AGENT` değerini kendi iletişim bilginizle
güncelleyin — Wikidata, kimliğini bildirmeyen istemcileri engeller.

## Veritabanını hazırlama

```bash
npm run db:migrate      # şemayı SQLite'a uygula (prisma/dev.db oluşur)
npm run etl             # Wikidata'dan veriyi çek ve yükle
```

ETL, Wikidata'ya nazik davranmak için saniyede bir istek atar; ilk tam çekim
**yarım saatten uzun sürebilir**. Ham yanıtlar `scripts/etl/.cache/` altında
saklanır, bu yüzden sonraki koşular çok daha hızlıdır.

| ETL komutu                      | Ne yapar                                   |
| ------------------------------- | ------------------------------------------ |
| `npm run etl -- verify-leagues` | Yalnızca lig QID'lerini doğrular (hızlı)   |
| `npm run etl -- --max-clubs=3`  | Küçük deneme koşusu                        |
| `npm run etl -- --dry-run`      | Çeker ve doğrular, veritabanına **yazmaz** |
| `npm run etl -- --no-cache`     | Disk önbelleğini atlar                     |

Wikidata'ya bağlanan **tek** süreç budur. Web uygulaması çalışırken hiçbir dış
servise istek gitmez (PROJECT.md §7.4).

```bash
npm run dev             # http://localhost:3000
```

## Komutlar

| Komut                   | Ne yapar                                                    |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Geliştirme sunucusu                                         |
| `npm run build`         | Üretim derlemesi                                            |
| `npm start`             | Derlenmiş uygulamayı çalıştırır                             |
| `npm run typecheck`     | TypeScript denetimi (`tsc --noEmit`)                        |
| `npm run lint`          | ESLint — katman sınırı ve güvenlik kuralları dâhil          |
| `npm run format`        | Prettier ile biçimlendirme                                  |
| `npm test`              | Birim testleri                                              |
| `npm run test:coverage` | Kapsam raporu (domain/application için eşik %85)            |
| `npm run audit:ci`      | **Üretim** bağımlılık ağacında güvenlik taraması — 0 olmalı |
| `npm run audit:full`    | Tüm ağaç (dev araçları dâhil), bilgilendirme amaçlı         |
| `npm run verify`        | Yukarıdakilerin tümü sırayla — commit öncesi çalıştırın     |

Faz 1'den itibaren: `npm run db:migrate`, `npm run db:studio`, `npm run etl`.

## Mimari — kısa özet

```
src/domain/          saf iş kuralları        (hiçbir şeye bağımlı değil)
src/application/     use-case'ler, port'lar  (yalnızca domain'e bakar)
src/infrastructure/  Prisma, cache, config   (port'ları uygular)
src/app/             Next.js sayfa ve API'leri
scripts/etl/         Wikidata veri çekimi    (ağa çıkan TEK yer)
```

Bağımlılık yönü **içe doğrudur** ve bu ESLint ile zorlanır: `src/domain/`
içinden `next`, `react` veya `@prisma/client` import etmeye çalışırsanız lint
hata verir. Ayrıntı: [PROJECT.md §4](./PROJECT.md).

## Güvenlik

Uygulama kimlik doğrulaması olmayan, salt-okunur ve herkese açık bir servistir;
saldırı yüzeyi bilinçli olarak küçük tutulmuştur. Öne çıkanlar:

- **Nonce tabanlı CSP** — her istekte yeniden üretilir (`src/proxy.ts`).
- **Dış servis yalıtımı** — Wikidata'ya yalnızca çevrimdışı ETL erişir; bir
  kullanıcı isteği hiçbir zaman üçüncü taraf servise gitmez.
- **Sınırlarda doğrulama** — her girdi Zod ile ayrıştırılır.
- **Parametreli sorgu** — Prisma'nın `*Unsafe` metotları lint ile yasaklıdır.
- **Sızıntısız hata** — `500` yanıtları yığın izi veya SQL parçası içermez.

Tam tehdit modeli ve gerekçeler: [PROJECT.md §7](./PROJECT.md).

Bir güvenlik açığı fark ederseniz lütfen herkese açık issue açmak yerine depo
sahibiyle doğrudan iletişime geçin.

## Veri kaynağı ve lisans

Oyuncu ve kulüp verileri [Wikidata](https://www.wikidata.org)'dan alınır
(**CC0**). Kulüp armaları Wikimedia Commons üzerinden gösterilir; her görselin
kendi lisansı geçerlidir.

## Durum

Faz 0 (temel altyapı) tamamlandı. Sıradaki adım Faz 1 — veri modeli ve
Wikidata ETL süreci. Yol haritası: [PROJECT.md §10](./PROJECT.md).
