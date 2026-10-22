import { generateGrid } from "../src/application/game-modes/grid/generate";
import { dailySeed } from "../src/domain/value-objects/daily-seed";
import { repositories } from "../src/infrastructure/db/repositories";

/**
 * Izgara üretilebilirlik ölçümü — §9.1 (geçici betik).
 *
 * Havuz 82→39 kulübe indirildikten sonra günlük ızgaranın HÂLÂ her gün
 * kurulabildiğini gerçek veriyle doğrular. `DAYS` ortamdan okunur.
 */
async function main(): Promise<void> {
  const days = Number(process.env.DAYS ?? "90");
  const deps = { clubs: repositories.clubs, players: repositories.players };

  let ok = 0;
  const freq = new Map<string, number>();
  const start = new Date();
  const t0 = Date.now();

  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const grid = await generateGrid(dailySeed(d), deps);
    if (grid === null) {
      console.log(`  GÜN ${i}: ÜRETİLEMEDİ (${d.toISOString().slice(0, 10)})`);
      continue;
    }
    ok += 1;
    for (const c of [...grid.rows, ...grid.columns]) {
      if (c.type === "club") {
        freq.set(c.label, (freq.get(c.label) ?? 0) + 1);
      }
    }
  }

  const ms = Date.now() - t0;
  console.log(`\nGeçerli ızgara: ${ok}/${days}`);
  console.log(
    `Süre: ${(ms / days).toFixed(0)} ms/ızgara (toplam ${(ms / 1000).toFixed(1)} s)`,
  );

  const counts = [...freq.values()];
  const appeared = freq.size;
  console.log(
    `Çıkan kulüp sayısı: ${appeared}/39 · kulüp başına min ${Math.min(...counts)} · max ${Math.max(...counts)}`,
  );
  const sorted = [...freq.entries()].sort((a, b) => a[1] - b[1]);
  console.log(
    "En seyrek 6:",
    sorted
      .slice(0, 6)
      .map(([k, v]) => `${k}(${v})`)
      .join(", "),
  );
  console.log(
    "En sık 6:   ",
    sorted
      .slice(-6)
      .map(([k, v]) => `${k}(${v})`)
      .join(", "),
  );

  process.exit(0);
}

void main();
