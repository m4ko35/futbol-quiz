import { CURATED_CLUB_QIDS } from "../../src/application/curated-clubs";
import { STAT_KEYS } from "../../src/domain/services/stat-match";
import { PrismaStatMatchRepository } from "../../src/infrastructure/db/repositories/prisma-stat-match-repository";
import { PrismaWhichMoreRepository } from "../../src/infrastructure/db/repositories/prisma-which-more-repository";
import { Prisma, PrismaClient } from "../../src/generated/prisma";
import { MIN_SPELLS_FOR_SELECTABLE } from "./leagues";
import { MAX_SPELL_TALLY, POSITIONS } from "./pipeline/normalize";

/**
 * BR-22 — ikinci kaynağın doğruladığı "gol > maç" kaydı için tavan.
 *
 * KOŞUDAN SONRA ÖLÇÜLDÜ: 140. İlk tavan 150 idi ve çevrimdışı bir tahmine
 * (76) dayanıyordu; gerçek sayı ona iki kat yakın çıkınca kapı payını
 * kaybetti — rutin bir tazeleme onu çalıştırabilirdi. Tavan ölçülen değerin
 * iki katına çekildi.
 *
 * Tahmin neden düşük kaldı: çevrimdışı ölçüm yalnızca önbellekteki
 * sayfaları okuyup dönemleri MAÇ SAYISI vekiliyle eşleştiriyordu. Boru
 * hattı ise kulüpleri QID ile çözüyor ve beş dili de tarıyor.
 */
const MAX_CORROBORATED_OVER_APPS = 300;

/**
 * Yüklenen veri kümesinin kabul kontrolü — `npm run db:verify`.
 *
 * NEDEN BİRİM TESTİ DEĞİL: burada denetlenen şey kod değil, ETL'in ürettiği
 * **veri artefaktı**. CI'da böyle bir veritabanı yoktur; kontrol çekimden
 * sonra, veriye karşı çalıştırılır ve hatalı çıkışla biter.
 *
 * NEDEN VAR: Faz 1 boyunca doğrulama "birkaç kulübe bakıp iyi görünüyor"
 * demekten ibaretti ve üç ayrı gerilemeyi kaçırdı (Augsburg 0 dönemle girdi,
 * sonra Barcelona ve Antalyaspor kabuk varlığa taşındı — §5.3). Bu betiğin
 * ilk sürümü sonuncusunu ilk koşuda yakaladı. Kulüp evreni sorgularına her
 * dokunuşta yeniden çalıştırılır.
 */

const prisma = new PrismaClient();

/**
 * Seçilebilir olması ZORUNLU kulüpler — **QID ile** sabitlenmiş.
 *
 * Neden ada göre değil QID'e göre: bozulan şey tam olarak "hangi varlık"
 * sorusuydu. Wikidata'da aynı adı taşıyan birden çok kayıt var ve yanlış olan
 * da doğru adı taşıyor (`Q3091261` de "FC Barcelona" diyor, ama 22 oyuncusu
 * var). Ada bakan bir kontrol bu hataların hiçbirini göremezdi.
 *
 * Liste keyfi değil: her satır bir kez bozulmuş bir kulüptür. Yeni bir
 * kulüp-eşleme hatası düzeltildiğinde buraya eklenir, böylece aynı hata
 * ikinci kez sessizce geri gelemez.
 */
const MUST_BE_SELECTABLE: readonly { qid: string; why: string }[] = [
  { qid: "Q101859", why: "Wolfsburg — P118'de yok, sezon katılımcısı" },
  { qid: "Q6463", why: "St. Pauli — P118'de yok, sezon katılımcısı" },
  { qid: "Q162251", why: "Heidenheim — P118'de yok, sezon katılımcısı" },
  { qid: "Q15755", why: "Augsburg — sezon varlığı; gerçek kulüp P831 ucunda" },
  { qid: "Q7156", why: "Barcelona — P831 çözümlemesi kabuğa taşımıştı" },
  { qid: "Q43710", why: "Antalyaspor — P831 çözümlemesi ana kulübe taşımıştı" },
  { qid: "Q15789", why: "Bayern — tek sınıflı tür kısıtında düşüyordu" },
  { qid: "Q495299", why: "Galatasaray — Süper Lig kapsamı" },
  { qid: "Q6601875", why: "Fenerbahçe — Süper Lig kapsamı" },
  { qid: "Q192641", why: "Trabzonspor — Süper Lig kapsamı" },
  // Yayın öncesi genişlemenin VAR OLMA SEBEBİ bu kulüpler (§1.3). Lig
  // eklenip bu üçü gelmezse genişleme hiçbir işe yaramamış demektir.
  { qid: "Q81888", why: "Ajax — Eredivisie kapsamı" },
  { qid: "Q128446", why: "Porto — Primeira Liga kapsamı" },
  { qid: "Q131499", why: "Benfica — Primeira Liga kapsamı" },
  // Avrupa-1 paketi; QID'ler ligin kulüp listesinden OKUNDU, yazılmadı.
  { qid: "Q19593", why: "Celtic — İskoçya kapsamı" },
  { qid: "Q19597", why: "Rangers — İskoçya kapsamı" },
  { qid: "Q187528", why: "Anderlecht — Belçika kapsamı" },
  { qid: "Q190916", why: "Club Brugge — Belçika kapsamı" },
  { qid: "Q19628", why: "Olympiakos — Yunanistan kapsamı" },
  { qid: "Q4122219", why: "Panathinaikos — Yunanistan kapsamı" },
  { qid: "Q189671", why: "Basel — İsviçre kapsamı" },
  { qid: "Q190526", why: "Young Boys — İsviçre kapsamı" },
  // Avrupa-2 paketi. Malmö ve Rosenborg BİLEREK YOK: ikisinin de Wikidata'da
  // ikiz varlığı var ve hangisinin asıl kalacağına §5.3'ün birleştirmesi
  // DÖNEM SAYISINA bakarak karar veriyor. Tahmin edilen bir QID'i kapıya
  // koymak, kapının kendisini kırılgan yapardı.
  { qid: "Q29108", why: "Zenit — Rusya kapsamı" },
  { qid: "Q29112", why: "Spartak Moskova — Rusya kapsamı" },
  { qid: "Q193749", why: "Legia — Polonya kapsamı" },
  { qid: "Q52942", why: "Lech Poznań — Polonya kapsamı" },
  { qid: "Q193481", why: "Sparta Prag — Çekya kapsamı" },
  { qid: "Q194393", why: "Slavia Prag — Çekya kapsamı" },
  { qid: "Q172803", why: "Dinamo Zagreb — Hırvatistan kapsamı" },
  { qid: "Q181216", why: "Hajduk Split — Hırvatistan kapsamı" },
  { qid: "Q211906", why: "Brøndby — Danimarka kapsamı" },
  { qid: "Q618520", why: "Midtjylland — Danimarka kapsamı" },
  { qid: "Q221602", why: "AIK — İsveç kapsamı" },
  { qid: "Q201567", why: "IFK Göteborg — İsveç kapsamı" },
  { qid: "Q208552", why: "Molde — Norveç kapsamı" },
  { qid: "Q205685", why: "Brann — Norveç kapsamı" },
  // İkiz galipleri: koşudan SONRA ölçülüp eklendi (652 ve 418 dönem). Önce
  // tahmin edilmedi; §5.3 kararı dönem sayısına bakıyor ve tahmin edilen bir
  // QID kapının kendisini kırılgan yapardı.
  { qid: "Q204881", why: "Malmö FF — İsveç kapsamı, ikiz galibi" },
  { qid: "Q186785", why: "Rosenborg — Norveç kapsamı, ikiz galibi" },
  // Avrupa-3. Sturm Graz BİLEREK YOK: QID'i çok yeni (Q124007617), yani
  // muhtemelen ikiz bir varlık ve §5.3 hangisini asıl sayacağını dönem
  // sayısına bakarak belirliyor (Malmö/Rosenborg ile aynı gerekçe).
  { qid: "Q131215", why: "Rapid Wien — Avusturya kapsamı" },
  { qid: "Q131209", why: "Austria Wien — Avusturya kapsamı" },
  { qid: "Q994811", why: "Red Bull Salzburg — Avusturya kapsamı" },
  { qid: "Q172969", why: "Şahtar Donetsk — Ukrayna kapsamı" },
  { qid: "Q179075", why: "Dinamo Kiev — Ukrayna kapsamı" },
  { qid: "Q179658", why: "Steaua Bükreş — Romanya kapsamı" },
  { qid: "Q204237", why: "Dinamo Bükreş — Romanya kapsamı" },
  // Avrupa dışındaki ilk iki lig (§1.3, beşinci genişleme). QID'ler yine
  // KOŞUDAN SONRA, ligin kendi kulüp listesinden dönem sayısına bakılarak
  // okundu — bu projede ezberden yazılan QID yedi kez yanlış çıktı.
  { qid: "Q204357", why: "LA Galaxy — MLS kapsamı (382 dönem)" },
  { qid: "Q204220", why: "New York Red Bulls — MLS kapsamı (488 dönem)" },
  { qid: "Q73965", why: "Al-Hilal — Suudi kapsamı (329 dönem)" },
  { qid: "Q482764", why: "Al-Nassr — Suudi kapsamı (378 dönem)" },
];

/** MVP'nin çekirdek sorusu boş dönmemesi gereken çiftler. */
const KNOWN_PAIRS: readonly [string, string][] = [
  ["galatasaray", "arsenal"],
  ["real madrid", "manchester united"],
  ["barcelona", "bayern"],
  ["liverpool", "everton"],
  ["fenerbahce", "besiktas"],
];

/**
 * Eşik ETL ile tek kaynaktan okunur; burada yeniden yazılırsa iki değer
 * sessizce birbirinden ayrılır ve kontrol yanlış şeyi doğrulamaya başlar.
 */
const MIN_SPELLS = MIN_SPELLS_FOR_SELECTABLE;

/**
 * BR-8 — kanıtsız dönem oranının tavanı (PROJECT.md §8.2).
 *
 * Kanıtsız dönemler elenmiyor, etiketleniyor. Etiketlemenin dürüst kalması
 * oranın küçük kalmasına bağlıdır: oran büyürse arayüzdeki uyarı bir istisnayı
 * değil ÇOĞUNLUĞU tarif etmeye başlar ve hiçbir şey ifade etmez.
 *
 * Ölçülen değer %11,7 (2026-07-30). Tavan, mevcut gürültüyü cezalandırmak için
 * değil KÖTÜLEŞMEYİ yakalamak için var; bu yüzden gerçekçi bir tamponla konur.
 * Wikidata'nın belgelenmemiş kayıtları temizlemesi oranı düşürebilir, yeni lig
 * kapsamı yükseltebilir — %18'i aşması ise kaynakta yapısal bir değişiklik
 * demektir ve bakılmadan yayına çıkmamalıdır.
 */
const MAX_UNEVIDENCED_RATIO = 0.18;

const failures: string[] = [];

function check(ok: boolean, message: string): void {
  console.log(`  ${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
}

async function reportCounts(): Promise<void> {
  const [leagues, clubs, selectable, players, spells, loans] =
    await Promise.all([
      prisma.league.count(),
      prisma.club.count(),
      prisma.club.count({ where: { isSelectable: true } }),
      prisma.player.count(),
      prisma.spell.count(),
      prisma.spell.count({ where: { isLoan: true } }),
    ]);

  console.log("=== Sayımlar ===");
  console.log(`  lig    ${leagues}`);
  console.log(`  kulüp  ${clubs} (seçilebilir ${selectable})`);
  console.log(`  oyuncu ${players}`);
  console.log(`  dönem  ${spells} (kiralık ${loans})`);
}

async function verifyTargetClubs(): Promise<void> {
  console.log("\n=== Zorunlu kulüpler seçilebilir mi? ===");

  for (const { qid, why } of MUST_BE_SELECTABLE) {
    const club = await prisma.club.findUnique({
      where: { wikidataId: qid },
      include: { _count: { select: { spells: true } } },
    });

    if (club === null) {
      check(false, `${qid} veri kümesinde yok — ${why}`);
      continue;
    }
    if (!club.isSelectable) {
      check(false, `${qid} ${club.shortName} seçilemez işaretli — ${why}`);
      continue;
    }

    const count = club._count.spells;
    check(
      count >= MIN_SPELLS,
      `${qid.padEnd(10)} ${club.shortName.padEnd(22)} ${String(count).padStart(4)} dönem`,
    );
  }
}

async function verifyIntegrity(): Promise<void> {
  console.log("\n=== Bütünlük ===");

  const [emptyClubs, stalePlayers, selectableClubs] = await Promise.all([
    prisma.club.count({ where: { spells: { none: {} } } }),
    prisma.player.count({ where: { spells: { none: {} } } }),
    prisma.club.findMany({
      where: { isSelectable: true },
      select: { shortName: true, _count: { select: { spells: true } } },
    }),
  ]);

  // Eşiğin altında kalmasına rağmen seçilebilir işaretli kulüp: yükleme
  // adımının seçilebilirlik hesabı ile veritabanının çeliştiği anlamına gelir.
  // Kullanıcı böyle bir kulübü seçip neredeyse boş sonuç alırdı.
  const weak = selectableClubs.filter((c) => c._count.spells < MIN_SPELLS);

  // BR-36'nın paydası. Sıfır kalırsa kural sessizce SUSAR — dejenere çift
  // uyarısı hiç çıkmaz ve bu, ekranda hiçbir belirti vermeyen bir gerileme
  // olurdu. Seçilebilir kulübün altyapı dışı oyuncusu olmalı.
  const unmeasured = await prisma.club.count({
    where: { isSelectable: true, playerCount: 0 },
  });

  check(emptyClubs === 0, `dönemi olmayan kulüp: ${emptyClubs}`);
  check(stalePlayers === 0, `dönemi olmayan oyuncu: ${stalePlayers}`);
  check(
    unmeasured === 0,
    `seçilebilir ama oyuncu sayısı 0 (BR-36 paydası): ${unmeasured}`,
  );
  check(
    weak.length === 0,
    `seçilebilir ama ${MIN_SPELLS} dönemden az: ${weak.length}` +
      (weak.length > 0
        ? ` (${weak
            .slice(0, 5)
            .map((c) => `${c.shortName}:${c._count.spells}`)
            .join(", ")})`
        : ""),
  );
}

/**
 * Seçicide ayırt edilebilir kısa ad — §5.3.
 *
 * KULLANICININ GÖRDÜĞÜ ŞEYİ ÖLÇER: kulüp seçici yalnızca `isSelectable`
 * kulüpleri sunuyor ve satırı kısa ad + ülke ile basıyor. İkisi de aynı olan
 * iki kulüp, kullanıcı için ayırt edilemez — hangisini seçtiğini bilemez.
 *
 * SERT HATA, uyarı değil. `club-labels.ts` üç kademeyle ölçülen üç çakışmanın
 * hepsini açıyor; buraya bir şey düşerse geriye kalan tek açıklama kaynakta
 * birleştirilmesi gereken gerçek bir ikizdir ve o hâlde oyun oynanamaz.
 */
async function verifyClubLabels(): Promise<void> {
  console.log("\n=== Seçicide ayırt edilebilir ad (§5.3) ===");

  const clubs = await prisma.club.findMany({
    where: { isSelectable: true },
    select: { shortName: true, country: true, wikidataId: true },
  });

  const groups = new Map<string, string[]>();
  for (const club of clubs) {
    const key = `${club.shortName}|${club.country ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), club.wikidataId]);
  }

  const collisions = [...groups.entries()].filter(([, ids]) => ids.length > 1);

  check(
    collisions.length === 0,
    `aynı görünen seçilebilir kulüp: ${collisions.length}` +
      (collisions.length > 0
        ? ` (${collisions
            .slice(0, 5)
            .map(([key, ids]) => `${key} → ${ids.join("/")}`)
            .join(", ")})`
        : ""),
  );

  // Ayırt edici ad ALDIKLARI da görünsün: geçişin çalıştığının kanıtı.
  const withYear = clubs.filter((c) => /\(\d{4}\)$/u.test(c.shortName));
  console.log(
    `  · ${clubs.length} seçilebilir kulüp, ${withYear.length} tanesi kuruluş yılıyla ayrıldı`,
  );
}

/**
 * BR-8 kanıt oranı — §8.2.
 *
 * Ölçüt `hasEvidence`'ın olumsuzudur ve DOMAIN'DEKİ kuralla aynı dört alana
 * bakar. Burada Prisma `where`'i olarak yazılmış olması bir kopya değil bir
 * çeviridir; kural değişirse önce `hasEvidence` güncellenir, sonra burası.
 */
async function verifyEvidenceRatio(): Promise<void> {
  console.log("\n=== Kanıt düzeyi (BR-8) ===");

  const [total, unevidenced] = await Promise.all([
    prisma.spell.count(),
    prisma.spell.count({
      where: {
        startYear: null,
        endYear: null,
        appearances: null,
        goals: null,
      },
    }),
  ]);

  if (total === 0) {
    check(false, "hiç dönem kaydı yok");
    return;
  }

  const ratio = unevidenced / total;
  check(
    ratio <= MAX_UNEVIDENCED_RATIO,
    `kanıtsız dönem ${unevidenced}/${total} = %${(ratio * 100).toFixed(1)} ` +
      `(tavan %${(MAX_UNEVIDENCED_RATIO * 100).toFixed(0)})`,
  );
}

/**
 * Mevki alanı kapalı bir kümedir.
 *
 * NEDEN VAR: `normalizePosition` bir dönem tanımadığı etiketi HAM hâliyle
 * geçiriyordu ve Wikidata'nın `P413` alanı yalnızca futbol mevkisi taşımıyor.
 * Veri kümesine bir bakanlık ("İçişleri Bakanlığı (İngiltere)"), bir kişi adı
 * ("Iván Luquetta"), çözülememiş bir QID ve kriket/ragbi/voleybol mevkileri
 * girmişti — hepsi arayüzde oyuncunun mevkisi olarak görünüyordu.
 *
 * Kural düzeltildi; bu kontrol düzeltmenin GEÇERLİ KALDIĞINI ölçer. Kaynak
 * yeni bir etiket üretirse ya da kural gevşetilirse veri yenilendiği anda
 * patlar, yayına çıkmadan önce.
 */
async function verifyPositions(): Promise<void> {
  console.log("\n=== Mevki değerleri ===");

  const rows = await prisma.player.groupBy({
    by: ["position"],
    _count: { _all: true },
  });

  const unexpected = rows.filter(
    (row) => row.position !== null && !POSITIONS.includes(row.position),
  );

  check(
    unexpected.length === 0,
    `beklenmeyen mevki değeri: ${unexpected.length}` +
      (unexpected.length > 0
        ? ` (${unexpected
            .slice(0, 5)
            .map((row) => `${String(row.position)}:${String(row._count._all)}`)
            .join(", ")})`
        : ` — izin verilenler: ${POSITIONS.join(", ")}`),
  );
}

/**
 * Izgara havuzu — §9.1.
 *
 * NEDEN BURADA: havuz kodda sabit bir QID listesidir, veri ise altı ayda bir
 * yenilenir. Wikidata bir kulübü başka bir varlığa birleştirirse ya da kulüp
 * seçilebilirlik eşiğinin altına düşerse, havuzdaki satır sessizce ölü bir
 * göndermeye dönüşür: üretim o kulübü hiç seçmez ve kimse fark etmez.
 * Burada patlar — veri yenilendiği anda, yayına çıkmadan önce.
 *
 * Kulüp sayısı da denetlenir: ızgara üç sütun ister, dördün altına düşen bir
 * havuz `generateGrid`'i her gün başarısız kılar.
 */
async function verifyGridPool(): Promise<void> {
  console.log("\n=== Izgara havuzu (§9.1) ===");

  const found = await prisma.club.findMany({
    where: { wikidataId: { in: [...CURATED_CLUB_QIDS] }, isSelectable: true },
    select: { wikidataId: true },
  });

  const present = new Set(found.map((club) => club.wikidataId));
  const missing = CURATED_CLUB_QIDS.filter((qid) => !present.has(qid));

  check(
    missing.length === 0,
    `havuzdaki ${CURATED_CLUB_QIDS.length} QID'den ${present.size} tanesi seçilebilir` +
      (missing.length > 0 ? ` — eksik: ${missing.join(", ")}` : ""),
  );
  check(
    present.size >= 4,
    `üretim için yeterli kulüp var (${present.size} ≥ 4)`,
  );
}

/**
 * İstatistik eşleştirme verisi — §9.2.
 *
 * ÜÇ AYRI ŞEY DENETLENİR ve üçü de farklı bir kusuru yakalar:
 *
 *  1. KAPSAM ALT SINIRI. Yeni alanlar hiç çekilmemişse ya da sorgu bozulmuşsa
 *     tablo sessizce boş kalır ve mod "bugünün oyuncusu hazırlanamadı" der.
 *
 *     ÖLÇÜLEN DEĞERLER (76.358 oyuncunun TAMAMI, 2026-07-31):
 *       millî maç %19,3 · boy %35,4 · kilo %22,4
 *
 *     Eşikler bunların dörtte üçüne konur. İlk denemede millî maç için %20
 *     yazılmıştı ve kontrol ilk koşuda düştü — çünkü o sayı havuzdaki
 *     TANINMIŞ oyuncularda ölçülen %73'ten akıl yürütülmüştü. Veri kümesinin
 *     tamamı alt lig oyuncularını da içeriyor ve onların millî maçı yok.
 *     Amaç mevcut durumu cezalandırmak değil ÇÖKÜŞÜ yakalamak (BR-8'in kanıt
 *     oranı tavanıyla aynı gerekçe).
 *
 *  2. AKLA YATKIN ARALIK. `normalize.ts` aralık dışını eliyor; bu kontrol
 *     elemenin gerçekten çalıştığını veride ölçer.
 *
 *  3. ADAY HAVUZU. BR-15 altı istatistiğin de dolu olmasını ister. Havuz
 *     365'in altına düşerse yıl dolmadan oyuncular tekrar etmeye başlar.
 */
/**
 * Alt sınırlar ölçülen kapsamın ALTINA konur: kapı gerilemeyi yakalamalı,
 * normal dalgalanmada ötmemeli. Ölçüm (2026-08-13, 132.263 oyuncu):
 * millî maç %17,4 · boy %34,9 · doğum tarihi **%98,7**.
 *
 * `weight` kaldırıldı çünkü kilo artık bir oyun istatistiği değil (§9.2);
 * sütun veride duruyor ama hiçbir moda girmiyor, dolayısıyla kapsamı
 * yayını durdurmamalı.
 */
const MIN_STAT_COVERAGE = { caps: 0.14, height: 0.26, birth: 0.9 } as const;
const MIN_DAILY_CANDIDATES = 365;

/**
 * Künyesi eksik arma sayısının tavanı — BR-34.
 *
 * SIFIR. Geçiş dönemi bitti: `npm run db:crests` 283 eski armanın künyesini
 * tamamladı, doğrulanamayan 1 tanesini kaldırdı ve ölçülen sonuç 0/413.
 * Tavan bir pay değil bir KURAL: künyesi eksik arma zaten gösterilmemeli, o
 * yüzden veritabanında da bulunmamalı.
 */
const MAX_UNCREDITED_CRESTS = 0;

/**
 * BR-21 / BR-22 — arama ağırlığı ve maç/gol akla yatkınlığı.
 *
 * Üçü de bir kez ölçülerek bulunmuş hatadır; buradaki amaç aynı hatanın
 * sessizce geri gelmesini engellemek:
 *
 *   · 5000 maçlık dönem (Renaldo Lopes da Cruz) — sıralamayı ele geçirirdi
 *   · 1987 maçlık dönem (Maldini) — aslında katılış yılı
 *   · gol > maç olan dönemler — imkânsız DEĞİL, yalnızca şüpheli; ikinci
 *     kaynak doğrulamadıkça düşerler ve kalan sayı tavanla sınırlanır
 */
async function verifySpellTallies(): Promise<void> {
  console.log("\n=== Maç/gol akla yatkınlığı (BR-22) ===");

  const [absurdApps, absurdGoals, goalsOverApps] = await Promise.all([
    prisma.spell.count({ where: { appearances: { gt: MAX_SPELL_TALLY } } }),
    prisma.spell.count({ where: { goals: { gt: MAX_SPELL_TALLY } } }),
    prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS n FROM spells
      WHERE goals IS NOT NULL AND appearances IS NOT NULL AND goals > appearances`),
  ]);

  check(absurdApps === 0, `${MAX_SPELL_TALLY}+ maçlı dönem: ${absurdApps}`);
  check(absurdGoals === 0, `${MAX_SPELL_TALLY}+ gollü dönem: ${absurdGoals}`);
  /*
   * BR-22 — "gol maçı aşamaz" ARTIK MUTLAK DEĞİL.
   *
   * Öncülü yanlıştı: elit golcüler maç sayısından fazla gol atar (Ronaldo
   * Real Madrid'de 292 maç / 311 gol). Kural artık ikinci kaynağın
   * doğruladığı kayıtları koruyor (§9.2, `resolveDisputedTallies`), bu yüzden
   * burada SIFIR beklenemez.
   *
   * Tavan yine de bir kapıdır: ölçülen kurtarma 76 dönemdi ve hepsi Vikipedi
   * ile mutabıktı. Sayı bunun çok üstüne çıkarsa doğrulama gevşemiş demektir.
   */
  const overApps = Number(goalsOverApps[0]?.n ?? 0);
  check(
    overApps <= MAX_CORROBORATED_OVER_APPS,
    `golü maçından fazla dönem: ${overApps} (tavan ${MAX_CORROBORATED_OVER_APPS}, ikinci kaynakla doğrulanmış olmalı)`,
  );

  // BR-21 sıralaması bu sütuna dayanıyor; hiç dolmadıysa arama alfabetiğe
  // düşer ve kullanıcı aradığı oyuncuyu bulamaz — sessiz bir gerileme.
  const ranked = await prisma.player.count({
    where: { careerAppearances: { gt: 0 } },
  });
  const players = await prisma.player.count();
  const ratio = players === 0 ? 0 : ranked / players;
  check(
    ratio >= 0.5,
    `arama ağırlığı dolu oyuncu: ${ranked}/${players} ` +
      `(%${(ratio * 100).toFixed(1)}, alt sınır %50)`,
  );
}

async function verifyPlayerStats(): Promise<void> {
  console.log("\n=== Oyuncu istatistikleri (§9.2) ===");

  const [total, caps, height, born] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { nationalCaps: { not: null } } }),
    prisma.player.count({ where: { heightCm: { not: null } } }),
    prisma.player.count({ where: { birthDate: { not: null } } }),
  ]);

  if (total === 0) {
    check(false, "hiç oyuncu yok");
    return;
  }

  const ratio = (n: number) => n / total;
  const pct = (n: number) => `%${(ratio(n) * 100).toFixed(1)}`;

  check(
    ratio(caps) >= MIN_STAT_COVERAGE.caps,
    `millî maç ${caps}/${total} = ${pct(caps)} (alt sınır %${(MIN_STAT_COVERAGE.caps * 100).toFixed(0)})`,
  );
  check(
    ratio(height) >= MIN_STAT_COVERAGE.height,
    `boy ${height}/${total} = ${pct(height)} (alt sınır %${(MIN_STAT_COVERAGE.height * 100).toFixed(0)})`,
  );
  check(
    ratio(born) >= MIN_STAT_COVERAGE.birth,
    `doğum tarihi ${born}/${total} = ${pct(born)} (alt sınır %${(MIN_STAT_COVERAGE.birth * 100).toFixed(0)})`,
  );

  // Aralık dışı değer "bilinmiyor"dan kötüdür: 2 cm boyunda futbolcu.
  const [badHeight, badCaps] = await Promise.all([
    prisma.player.count({
      where: { OR: [{ heightCm: { lt: 140 } }, { heightCm: { gt: 220 } }] },
    }),
    // Kimse 400'den fazla A millî maç yapmadı; aşan değer BR-14'ün
    // bozulduğunu (toplama geri döndüğünü) gösterir.
    prisma.player.count({ where: { nationalCaps: { gt: 400 } } }),
  ]);

  check(badHeight === 0, `aralık dışı boy: ${badHeight}`);
  check(badCaps === 0, `400'den fazla millî maç: ${badCaps}`);

  /**
   * DÜŞÜK KESİNLİKLİ DOĞUM TARİHİ — bilinen kusur, KAPI DEĞİL sayaç.
   *
   * Wikidata yüzyıl kesinlikli tarihleri de veriyor ve ETL onları tam tarih
   * gibi yazıyor: ölçüldü, **30 oyuncu** aralık dışında ve 20'den fazlası
   * tam olarak `1801-01-01`, biri `2100-01-01`. Bunlar gerçek tarih değil,
   * kesinlik artefaktı.
   *
   * NEDEN YAYINI DURDURMUYOR: hiçbiri oyun havuzuna girmiyor — havuz 100+
   * maç ve 2+ kulüp istiyor, bu kayıtların neredeyse tamamı 0 maçlık. Asıl
   * kapı aşağıda, aday havuzunun kendisinde (`verifyDailyCandidates`).
   * Buradaki sayı, kusurun BÜYÜMESİNİ görünür tutmak için basılıyor.
   */
  const lowPrecision = await prisma.player.count({
    where: {
      OR: [
        { birthDate: { lt: new Date("1850-01-01T00:00:00Z") } },
        { birthDate: { gt: new Date("2020-01-01T00:00:00Z") } },
      ],
    },
  });
  console.log(
    `  ℹ düşük kesinlikli doğum tarihi: ${lowPrecision} (havuz dışı, §9.2)`,
  );
}

async function verifyDailyCandidates(): Promise<void> {
  console.log("\n=== Günün oyuncusu havuzu (BR-15) ===");

  const repository = new PrismaStatMatchRepository(prisma);
  const candidates = await repository.findDailyCandidates();

  check(
    candidates.length >= MIN_DAILY_CANDIDATES,
    `altı istatistiği de dolu aday: ${candidates.length} ` +
      `(alt sınır ${MIN_DAILY_CANDIDATES} = bir yıl)`,
  );

  /**
   * ASIL DOĞUM YILI KAPISI BURADADIR, tüm oyuncularda değil.
   *
   * Wikidata yüzyıl kesinlikli tarihleri tam tarih gibi veriyor (`1801-01-01`,
   * `2100-01-01`). Bugün bunların hiçbiri havuza girmiyor çünkü havuz 100+ maç
   * istiyor; ama kapsam genişledikçe girebilirler ve o gün oyun "hangisi daha
   * yaşlı?" sorusunu 1801 doğumlu bir oyuncuyla sorardı. Kapı, o günü
   * kullanıcıdan önce görmek için var.
   */
  const implausible = candidates.filter(
    (c) => c.stats.birthYear < 1850 || c.stats.birthYear > 2020,
  );
  check(
    implausible.length === 0,
    `akla yatkın olmayan doğum yılı: ${implausible.length}` +
      (implausible.length === 0
        ? ""
        : ` (ör. ${implausible[0]?.name ?? "?"} → ${String(implausible[0]?.stats.birthYear)})`),
  );

  // Sıra KARARLI olmalı: günün seçimi bu listeye tohumla indekslenir ve
  // sıranın değişmesi aynı günün oyuncusunu değiştirirdi (BR-19).
  const second = await repository.findDailyCandidates();
  check(
    candidates.map((c) => c.id).join() === second.map((c) => c.id).join(),
    "aday sırası iki çağrıda aynı",
  );
}

/**
 * "Hangisi daha" havuzu — §9.3, BR-31.
 *
 * NEDEN AYRI BİR KAPI. BR-15'in havuzu altı istatistiğin de dolu olmasını
 * ister; buradaki havuz yalnızca SORULANI ister, yani istatistik başına ayrı
 * ayrı dolabilir ya da boşalabilir. Millî maç, boy ve doğum yılı kapsamı §9.2'de
 * zaten ölçülüyor ama o ölçüm TÜM oyuncular üzerinden; bu havuz tanınırlık
 * süzgecinden geçenleri sayar ve ikisi aynı şey değil.
 *
 * Bir istatistiğin havuzu boşalırsa `RoundUnavailableError` üretime çıkar ve
 * bunu ilk öğrenen kullanıcı olur.
 */
async function verifyWhichMorePool(): Promise<void> {
  console.log('\n=== "Hangisi daha" havuzu (BR-31) ===');

  const repository = new PrismaWhichMoreRepository(prisma);

  for (const key of STAT_KEYS) {
    // Havuzun DOLU olduğunu, bir çift kurulabildiğiyle ölçüyoruz: tek oyuncusu
    // olan bir havuz "boş değil" ama oyun kurulamaz.
    const first = await repository.findCandidate({
      statKey: key,
      threshold: null,
      side: "any",
      exclude: [],
    });

    if (first === null) {
      check(false, `${key}: havuz BOŞ`);
      continue;
    }

    const opponent = await repository.findCandidate({
      statKey: key,
      threshold: first.value,
      side: "any",
      exclude: [first.id],
    });

    check(
      opponent !== null,
      `${key}: BR-29 bandını sağlayan çift kurulabiliyor`,
    );
  }
}

/**
 * Arma lisansı — PROJECT.md §4.3.1, §7.3, BR-33, BR-34.
 *
 * İKİ AYRI KURAL, ikisi de veri tarafında ölçülüyor:
 *
 *  BR-33  Arma yalnızca Commons'tan gelir. Yapısal olarak denetlenebilir:
 *         Commons dosyaları `/wikipedia/commons/` yolunda durur, bir Vikipedi'ye
 *         yüklenmiş adil kullanım dosyaları ise `/wikipedia/tr/`, `/wikipedia/en/`
 *         gibi yerel yollarda. Konak ikisinde de aynı olduğu için CSP beyaz
 *         listesi bunu AYIRT EDEMEZ (§7.3) — kapı burada.
 *
 *  BR-34  Atıf künyesi eksik arma gösterilmez. Lisans ve dosya sayfası
 *         zorunludur; atıf gerektiren lisanslarda yazar da.
 */
async function verifyCrestLicensing(): Promise<void> {
  console.log("\n=== Arma lisansı (BR-33, BR-34) ===");

  const withCrest = await prisma.club.findMany({
    where: { crestUrl: { not: null } },
    select: {
      shortName: true,
      crestUrl: true,
      crestLicense: true,
      crestFilePage: true,
    },
  });

  const COMMONS_PREFIX = "https://upload.wikimedia.org/wikipedia/commons/";
  const outsideCommons = withCrest.filter(
    (club) => !(club.crestUrl ?? "").startsWith(COMMONS_PREFIX),
  );

  check(
    outsideCommons.length === 0,
    `Commons dışı arma: ${outsideCommons.length}` +
      (outsideCommons.length === 0
        ? ""
        : ` — ör. ${outsideCommons[0]?.shortName ?? "?"}`),
  );

  const missingCredit = withCrest.filter(
    (club) => club.crestLicense === null || club.crestFilePage === null,
  );

  check(
    missingCredit.length <= MAX_UNCREDITED_CRESTS,
    `künyesi eksik arma: ${missingCredit.length}/${withCrest.length}` +
      (missingCredit.length === 0
        ? ""
        : ` — ör. ${missingCredit[0]?.shortName ?? "?"}`),
  );

  const selectable = await prisma.club.count({ where: { isSelectable: true } });
  const selectableWithCrest = await prisma.club.count({
    where: { isSelectable: true, crestUrl: { not: null } },
  });
  console.log(
    `  ℹ seçilebilir kulüplerde arma: ${selectableWithCrest}/${selectable} ` +
      `(%${((selectableWithCrest / selectable) * 100).toFixed(1)})`,
  );
}

async function verifyKnownPairs(): Promise<void> {
  console.log("\n=== Ortak oyuncu çiftleri ===");

  for (const [aKey, bKey] of KNOWN_PAIRS) {
    const [clubA, clubB] = await Promise.all([
      prisma.club.findFirst({
        where: { searchKey: { contains: aKey }, isSelectable: true },
      }),
      prisma.club.findFirst({
        where: { searchKey: { contains: bKey }, isSelectable: true },
      }),
    ]);

    if (clubA === null || clubB === null) {
      check(false, `${aKey} ∩ ${bKey} — kulüp bulunamadı`);
      continue;
    }

    // BR-2: altyapı dönemleri ortaklık saymaz.
    const count = await prisma.player.count({
      where: {
        AND: [
          { spells: { some: { clubId: clubA.id, isYouth: false } } },
          { spells: { some: { clubId: clubB.id, isYouth: false } } },
        ],
      },
    });

    check(
      count > 0,
      `${clubA.shortName} ∩ ${clubB.shortName} → ${count} ortak oyuncu`,
    );
  }
}

async function main(): Promise<void> {
  try {
    await reportCounts();
    await verifyTargetClubs();
    await verifyIntegrity();
    await verifyClubLabels();
    await verifyEvidenceRatio();
    await verifyPositions();
    await verifyGridPool();
    await verifySpellTallies();
    await verifyPlayerStats();
    await verifyDailyCandidates();
    await verifyWhichMorePool();
    await verifyCrestLicensing();
    await verifyKnownPairs();
  } finally {
    await prisma.$disconnect();
  }

  if (failures.length > 0) {
    console.log(`\nKABUL BAŞARISIZ — ${failures.length} kontrol geçmedi:`);
    for (const failure of failures) console.log(`  · ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nKABUL BAŞARILI");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
