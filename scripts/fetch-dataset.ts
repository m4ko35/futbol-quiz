import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Yayımlanmış veri kümesini derleme öncesinde indirir — PROJECT.md §3.1.
 *
 * NEREDE ÇALIŞIR: dağıtım sağlayıcısının DERLEME adımında, `next build`'den
 * önce. Bir istek yolunda DEĞİL — §7.4'ün yasakladığı şey, kullanıcı isteğinin
 * dış bir servise gitmesidir; derleme adımı istek yolu değildir.
 *
 * NEDEN İNDİRİLİYOR: veri bir derleme çıktısıdır ve depoya konmaz (73 MB;
 * ayrıca kaynak değil, üretilmiş artefakt). ETL'i GitHub Actions üretir,
 * `db:verify` kapısından geçirir ve sürüm (release) varlığı olarak yayımlar.
 *
 * BAŞARISIZLIK GÜRÜLTÜLÜDÜR. Veri inmezse derleme DURUR. Alternatif — boş bir
 * veritabanıyla devam etmek — çalışıyor görünen ama hiçbir kulübü bulamayan
 * bir site üretirdi; sessizce bozuk bir dağıtım, düşen bir derlemeden çok daha
 * kötüdür.
 */

const TARGET = path.resolve(process.cwd(), "prisma", "dev.db");

/** Sürüm varlığının adresi; dağıtım ortamında verilir. */
const url = process.env.DATASET_URL;

/** Özel depolarda gerekir; herkese açık depoda boş bırakılır. */
const token = process.env.DATASET_TOKEN;

/**
 * Beklenen en küçük boyut (bayt).
 *
 * Kısmi bir indirme ya da hata sayfasının dosyaya yazılması, geçerli bir
 * SQLite dosyası gibi görünmez ama derlemeyi de durdurmaz — uygulama üretimde
 * ölürdü. Ölçülen boyut ~73 MB; eşik, veri kümesi küçülse bile bir HTML hata
 * sayfasının asla geçemeyeceği kadar yukarıda.
 */
const MIN_BYTES = 1_000_000;

async function main(): Promise<void> {
  if (url === undefined || url.length === 0) {
    throw new Error(
      "DATASET_URL tanımlı değil. Veri kümesi olmadan derleme yapılmaz — " +
        "önce `data-refresh` iş akışını çalıştırın (PROJECT.md §3.1).",
    );
  }

  const response = await fetch(url, {
    headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Veri kümesi indirilemedi: HTTP ${String(response.status)}. ` +
        "Adres ve yetki doğru mu?",
    );
  }

  await mkdir(path.dirname(TARGET), { recursive: true });

  // Tamamı belleğe alınıp tek seferde yazılıyor. Akış (stream) daha zarif
  // olurdu ama `Readable.fromWeb` web ve Node akış tipleri arasında döküm
  // gerektiriyor; §2.5 tip disiplini bir dökümü, burada hiçbir şey
  // kazandırmadığı hâlde kabul etmeyi gerektirmiyor. Bu betik DERLEME
  // adımında çalışır — ~73 MB'lık bir tampon orada sorun değil.
  const bytes = Buffer.from(await response.arrayBuffer());

  // ÖNCE geçici dosyaya, SONRA yerine taşı. Doğrudan hedefe yazmak, indirme
  // yarıda kesildiğinde geçerli sayılan yarım bir dosya bırakırdı.
  const temporary = `${TARGET}.download`;
  await rm(temporary, { force: true });
  await writeFile(temporary, bytes);

  const { size } = await stat(temporary);
  if (size < MIN_BYTES) {
    await rm(temporary, { force: true });
    throw new Error(
      `İnen dosya çok küçük (${String(size)} bayt). Muhtemelen bir hata ` +
        "sayfası indi, veri kümesi değil.",
    );
  }

  await rename(temporary, TARGET);
  console.log(
    `Veri kümesi indirildi: ${TARGET} (${(size / 1024 / 1024).toFixed(1)} MB)`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
