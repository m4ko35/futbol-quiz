import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CareerTotalConflict } from "./career-total-check";
import type { ValidationDetail } from "./validate";

/**
 * ETL tanı raporu — PROJECT.md §8.2.
 *
 * NEDEN VAR. Kapılar ilk gerçek koşuda ne bulduklarını söyledi ama
 * GÖSTEREMEDİ: 383 BR-42 çelişkisinin 8'i, 2.089 kariyer toplamı
 * çatışmasının 5'i, 12.749 kuruluş öncesi dönemin 8'i basıldı. Kırpma
 * günlük için doğru — bir CI günlüğüne 12 bin satır yazmak onu okunmaz kılar
 * — ama BR-42'nin kendi reçetesi "her biri elle incelenmeli" diyor. Reçete,
 * çıktısıyla uygulanamaz durumdaydı.
 *
 * ÇÖZÜM AYIRMAK: günlük ÖZET verir, bu dosyalar KANIT taşır. İş akışı
 * raporu artefakt olarak yüklüyor ve `if: always()` ile — asıl değeri
 * BAŞARISIZ koşuda olduğu için.
 *
 * TSV, JSON DEĞİL. Bu dosyaların tek işi insanın sınıflandırması: elektronik
 * tabloya yapıştırılıyor, sütuna göre sıralanıyor, sayılıyor. JSON o iş için
 * bir adım fazladan.
 *
 * RAPOR YÜKLEMEYİ ETKİLEMEZ. Yazma başarısız olursa ETL durmaz: rapor bir
 * teşhis aracıdır, kapı değil. Kapılar `validate.ts` içinde ve onlar zaten
 * kendi kararlarını verdi.
 */

/** Depoya girmez; `.gitignore` altında. */
export const REPORT_DIR = "etl-raporu";

function tsv(header: string | undefined, items: readonly string[]): string {
  const lines = header === undefined ? [...items] : [header, ...items];
  return lines.join("\n") + "\n";
}

export interface EtlReportInput {
  readonly details: readonly ValidationDetail[];
  readonly careerTotalConflicts: readonly CareerTotalConflict[];
}

/**
 * Raporu yazar ve yazılan dosyaların yollarını döner.
 *
 * DİZİN ÖNCE SİLİNİYOR: yarıda kalmış bir önceki koşudan kalan dosya, bu
 * koşunun bulgusu sanılırdı. Rapor bir birikim değil, tek bir koşunun
 * fotoğrafı.
 */
export async function writeEtlReport(
  input: EtlReportInput,
  cwd: string = process.cwd(),
): Promise<string[]> {
  const dir = path.join(cwd, REPORT_DIR);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const written: string[] = [];

  for (const detail of input.details) {
    const file = path.join(dir, `${detail.key}.tsv`);
    await writeFile(file, tsv(detail.header, detail.items), "utf8");
    written.push(`${detail.key}.tsv (${String(detail.items.length)} satır)`);
  }

  if (input.careerTotalConflicts.length > 0) {
    const file = path.join(dir, "kariyer-toplami-catismalari.tsv");
    await writeFile(
      file,
      tsv(
        "oyuncu\ttoplam_mac\ttoplam_gol\tlig_mac\tlig_gol\tsebep",
        input.careerTotalConflicts.map((c) =>
          [
            c.playerWikidataId,
            c.parsed.appearances ?? "",
            c.parsed.goals ?? "",
            c.leagueAppearances ?? "",
            c.leagueGoals ?? "",
            c.reason,
          ].join("\t"),
        ),
      ),
      "utf8",
    );
    written.push(
      `kariyer-toplami-catismalari.tsv (${String(input.careerTotalConflicts.length)} satır)`,
    );
  }

  return written;
}
