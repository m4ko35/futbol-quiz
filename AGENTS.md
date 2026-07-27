<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Futbol Quiz — proje kuralları

**Önce [PROJECT.md](./PROJECT.md) okunur.** Şartname bu projenin tek referans
kaynağıdır; kod ile belge çelişirse önce belge güncellenir, sonra kod yazılır.

## Değişmez kurallar

1. **Bağımlılık yönü içe doğrudur** (§2.1, §4.1). `src/domain/` hiçbir şeye —
   `next`, `react`, `@prisma/client` dâhil — bağımlı olamaz. ESLint bunu zorlar;
   kuralı devre dışı bırakarak çözmeye çalışmayın.
2. **Ağa yalnızca `scripts/etl/` çıkar** (§7.4). Bir istek yolunda (route
   handler, sayfa, servis) dış HTTP çağrısı yapılmaz.
3. **Sınırlarda Zod ile doğrulama** (§2.3). Ayrıştırılmamış girdi iç katmanlara
   geçemez.
4. **Ham SQL yasak** (§7.2). Prisma sorgu kurucusu veya `Prisma.sql` etiketli
   şablonu kullanılır; `$queryRawUnsafe` / `$executeRawUnsafe` lint hatasıdır.
5. **`any` yasak** (§2.5). Kaçınılmazsa gerekçesi yorumla yazılır.
6. **Hata yanıtları sızdırmaz** (§6.3). `500` gövdesinde yığın izi, SQL parçası
   veya dosya yolu bulunmaz.

## Bir değişiklikten sonra

```bash
npm run verify   # typecheck + lint + format:check + test + build
```

CSP veya render moduna dokunulduysa ek olarak §7.3'teki nonce doğrulaması
tekrarlanır: üretim derlemesi alınır, sunucu çalıştırılır ve sayfadaki her
script etiketinin CSP başlığındaki nonce ile eşleştiği ölçülür.

## Sürüme özgü tuzaklar

- Next 16'da middleware dosyası **`src/proxy.ts`**, dışa aktarılan fonksiyon
  **`proxy`** adını taşır.
- `export const dynamic` segment yapılandırmadan kaldırıldı; dinamik render için
  `connection()` kullanılır.
- Bağımlılık açıkları `npm audit fix --force` ile **çözülmez** — önerdiği
  "düzeltme" paketleri yıllar öncesine düşürür. Geçişli sürümler `overrides` ile
  yukarı sabitlenir (§7.7).
