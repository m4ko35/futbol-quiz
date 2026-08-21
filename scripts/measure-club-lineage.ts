import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../src/generated/prisma";
import { loadEtlConfig } from "./etl/config";
import { WikidataClient } from "./etl/sources/wikidata/client";
import { clubLineage } from "./etl/sources/wikidata/queries";

/**
 * KULÜP SOY ZİNCİRİ ÖLÇÜMÜ — PROJECT.md §5.3.
 *
 * NE SORUYOR. `clubDuplicates` şemsiye↔şube ikizlerini `P361`/`P831` ile
 * buluyor. Peki eksik olan ilişki HALEFİYET olabilir mi — `P1365`/`P1366`
 * (yerine geçer/yerini alır), `P155`/`P156` (önce/sonra gelen)?
 *
 * CEVAP ÖLÇÜLDÜ VE HAYIR (21 Ağustos 2026). Evrende iki ucu da içeride olan
 * yalnızca 4 zincir var ve biri BİRLEŞME: SC Fives ile Olympique Lillois
 * 1932-1943'te aynı anda var olan iki ayrı kulüptü, 1944'te birleşip Lille
 * OSC oldular. Halefiyet bağı gerçek ikizle gerçek birleşmeyi aynı özellikle
 * isaretliyor, yani §5.3'un elediği dört ayirt ediciye BESINCISI eklendi.
 *
 * O HÂLDE NEDEN DURUYOR. §5.3 doğru düzeltme yerinin KAYNAK olduğunu söylüyor:
 * eksik ilişki Wikidata'da eklenmeli. Bu betik o eklemenin OLUP OLMADIĞINI
 * gösteren araçtır — zincir sayısı artarsa kaynak düzelmiş demektir. Bir
 * sonraki koşunun sonucunu tahmin etmek yerine ölçmenin yolu.
 *
 * YAZMAZ. Yalnızca okur ve rapor basar. Okuduğu veri kümesi YERELDİR
 * (`prisma/dev.db`); üretimin evreniyle aynı olduğu varsayılmaz, koşan
 * kişinin kontrol etmesi gerekir.
 *
 * AYRIM SİNYALİ OLARAK KAÇ SELEF. Tek selefli zincir yeniden kuruluştur;
 * çok selefli düğüm birleşme ŞÜPHESİDİR. Betik ikisini ayırmaz, SAYAR —
 * Lille örneği ayrımın otomatikleştirilemeyeceğini gösterdi.
 */

const CACHE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "etl",
  ".cache",
);

interface ClubRow {
  readonly wikidataId: string;
  readonly name: string;
  readonly country: string | null;
  readonly foundedYear: number | null;
  readonly spells: number;
  readonly players: number;
  readonly selectable: boolean;
}

/** Birleşen bileşenler — soy zinciri bir çift değil, bir ZİNCİR olabilir. */
function components(
  ids: readonly string[],
  edges: readonly (readonly [string, string])[],
): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    return root;
  };

  for (const [a, b] of edges) {
    if (!parent.has(a) || !parent.has(b)) continue;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }

  return [...groups.values()].filter((g) => g.length > 1);
}

async function main(): Promise<void> {
  const config = loadEtlConfig();
  const prisma = new PrismaClient();
  const wikidata = new WikidataClient(config, CACHE_DIR);

  try {
    const clubs = await prisma.club.findMany({
      select: {
        wikidataId: true,
        name: true,
        country: true,
        foundedYear: true,
        isSelectable: true,
        _count: { select: { spells: true } },
      },
      orderBy: { name: "asc" },
    });

    // Oyuncu sayısı dönem sayısından farklı: aynı oyuncunun iki dönemi olabilir.
    const distinctPlayers = new Map<string, number>();
    for (const row of await prisma.spell.groupBy({
      by: ["clubId"],
      _count: { playerId: true },
    })) {
      distinctPlayers.set(String(row.clubId), row._count.playerId);
    }

    const byId = new Map<string, ClubRow>();
    const idOfKey = new Map<string, string>();
    for (const club of await prisma.club.findMany({
      select: { id: true, wikidataId: true },
    })) {
      idOfKey.set(club.wikidataId, String(club.id));
    }

    for (const club of clubs) {
      byId.set(club.wikidataId, {
        wikidataId: club.wikidataId,
        name: club.name,
        country: club.country,
        foundedYear: club.foundedYear,
        spells: club._count.spells,
        players:
          distinctPlayers.get(idOfKey.get(club.wikidataId) ?? "") ??
          club._count.spells,
        selectable: club.isSelectable,
      });
    }

    const ids = [...byId.keys()];
    console.log(`Evren: ${ids.length} kulüp\n`);

    console.log("Wikidata'dan halefiyet bağları isteniyor…");
    const bindings = await wikidata.queryBatch(
      ids,
      (batch) => clubLineage(batch),
      { label: "kulup-soy" },
    );

    const edges: [string, string][] = [];
    const propOf = new Map<string, Set<string>>();
    for (const row of bindings) {
      const a = row.club?.value.split("/").pop();
      const b = row.other?.value.split("/").pop();
      const prop = row.prop?.value.split("/").pop() ?? "?";
      if (a === undefined || b === undefined) continue;
      // İKİ UÇ DA EVRENDE olmalı: evren dışı bir selef bizi ilgilendirmiyor,
      // onun dönemleri zaten veri kümesinde yok.
      if (!byId.has(a) || !byId.has(b)) continue;
      edges.push([a, b]);
      const key = [a, b].sort().join("|");
      propOf.set(key, (propOf.get(key) ?? new Set()).add(prop));
    }

    console.log(`${edges.length} bağ, evrenin iki ucu da içinde\n`);

    const groups = components(ids, edges);
    groups.sort(
      (x, y) =>
        y.reduce((s, id) => s + (byId.get(id)?.spells ?? 0), 0) -
        x.reduce((s, id) => s + (byId.get(id)?.spells ?? 0), 0),
    );

    let totalClubs = 0;
    let totalSpells = 0;
    let sharedPlayerPairs = 0;

    console.log(`═══ ${groups.length} SOY ZİNCİRİ ═══\n`);

    for (const group of groups) {
      const rows = group
        .map((id) => byId.get(id))
        .filter((r): r is ClubRow => r !== undefined)
        .sort((a, b) => (a.foundedYear ?? 0) - (b.foundedYear ?? 0));

      const spells = rows.reduce((s, r) => s + r.spells, 0);
      totalClubs += rows.length;
      totalSpells += spells;

      const names = new Set(rows.map((r) => r.name));
      const flag = names.size < rows.length ? "  ⚠ AYNI AD" : "";

      // Ortak oyuncu: birleştirme bir kariyeri gerçekten toparlıyor mu?
      const players = await Promise.all(
        group.map((id) =>
          prisma.spell.findMany({
            where: { club: { wikidataId: id } },
            select: { playerId: true },
            distinct: ["playerId"],
          }),
        ),
      );
      const sets = players.map((list) => new Set(list.map((p) => p.playerId)));
      let shared = 0;
      for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
          const a = sets[i];
          const b = sets[j];
          if (a === undefined || b === undefined) continue;
          for (const p of a) if (b.has(p)) shared++;
        }
      }
      if (shared > 0) sharedPlayerPairs++;

      console.log(
        `${rows.length} kayıt · ${spells} dönem · ${shared} ortak oyuncu${flag}`,
      );
      for (const r of rows) {
        console.log(
          `    ${r.wikidataId.padEnd(12)} ${r.name.padEnd(34)} ` +
            `${String(r.foundedYear ?? "?").padStart(4)} ` +
            `${String(r.spells).padStart(5)} dönem ` +
            `${(r.country ?? "?").padEnd(3)} ` +
            `${r.selectable ? "seçilebilir" : "-"}`,
        );
      }
      const props = new Set<string>();
      for (const [key, set] of propOf) {
        const [a, b] = key.split("|");
        if (a !== undefined && b !== undefined && group.includes(a))
          for (const p of set) props.add(p);
      }
      console.log(`    bağ: ${[...props].sort().join(", ")}\n`);
    }

    console.log("═══ ÖZET ═══");
    console.log(`zincir            : ${groups.length}`);
    console.log(`etkilenen kulüp   : ${totalClubs}`);
    console.log(`etkilenen dönem   : ${totalSpells}`);
    console.log(`ortak oyuncusu VAR: ${sharedPlayerPairs} zincir`);
    console.log(
      `üçten fazla üye   : ${String(groups.filter((g) => g.length > 2).length)} zincir (birleşme şüphesi)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
