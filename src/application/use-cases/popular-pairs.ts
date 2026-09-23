import type { Club } from "@/domain/entities/club";
import { toClubDto, type ClubDto } from "../dto/club-dto";
import type { ClubRepository } from "../ports/club-repository";

/**
 * Popüler karşılaştırma çiftleri — ana sayfadaki hazır seçim çipleri.
 *
 * "HANGİ ÇİFTLER" BİR ÜRÜN KARARIDIR — curated-clubs.ts'teki tanınırlık
 * kararıyla aynı sınıf. Tanınırlık ölçülebilir bir veri değil (bkz.
 * `CURATED_CLUB_QIDS` yorumu); bu yüzden liste elle kurulur ve **QID ile**
 * sabitlenir. Veritabanı kimlikleri (`cuid`) her ETL koşusunda değişir, QID
 * değişmez; bir çip adres çubuğuna girmese de aynı gerekçe geçerli: liste
 * koşudan koşuya sabit kalmalı (§9.1 ile aynı ilke).
 *
 * DÜRÜSTLÜK: çip etiketi kulübün GERÇEK kısa adından türetilir (tek kaynak).
 * Bir kulüp veri kümesinden düşerse (ya da seçilebilir olmaktan çıkarsa) o çift
 * SESSİZCE ATLANIR — uydurma bir ad basılmaz. `db:verify` bu sekiz QID'nin
 * varlığını zaten denetler (§8.2), yani atlama pratikte beklenmez ama olursa
 * arayüz bozulmaz.
 */
interface PairQids {
  readonly a: string;
  readonly b: string;
}

/**
 * Küratörlü çiftler; hepsi CURATED_CLUB_QIDS içinde, yani db:verify kapsamında.
 *
 * ÜÇ ÇİFT, bilinçli: dört çip dar ekranda ikinci satıra taşıyordu; üçü tek
 * satırda daha dengeli durur. Tema üç Türk devi × bir Avrupa devi. Eş kulüpler
 * ÖRTÜŞMEYE göre seçildi (veriden ölçüldü) — çip boşa yakın bir sonuca
 * götürmesin: Beşiktaş'ın Barcelona ile 8 ortak oyuncusu var (Valencia 11 idi
 * ama Barcelona daha tanınır ve GS/FB'nin eşlerinden ayrı).
 */
const POPULAR_PAIR_QIDS: readonly PairQids[] = [
  { a: "Q495299", b: "Q8682" }, // Galatasaray × Real Madrid
  { a: "Q6601875", b: "Q631" }, // Fenerbahçe × Internazionale Milano
  { a: "Q172567", b: "Q7156" }, // Beşiktaş × Barcelona
];

export interface PopularPair {
  readonly a: ClubDto;
  readonly b: ClubDto;
}

export interface PopularPairsDeps {
  readonly clubs: ClubRepository;
}

/**
 * Küratörlü çiftleri güncel ClubDto'lara çözer.
 *
 * NEDEN QID BAŞINA AYRI ÇÖZÜM: `findByWikidataIds` dönen kulübü tekrar QID'e
 * eşlemez (varlıkta wikidataId yok) ve SQL `IN` giriş sırasını korumaz. Sekiz
 * benzersiz QID'i tek tek çözmek eşlemeyi yapısal olarak kesinleştirir; her
 * biri indeksli bir nokta aramadır ve sunucuda, paralel koşar — maliyet
 * ihmal edilebilir.
 */
export async function getPopularPairs(
  deps: PopularPairsDeps,
): Promise<PopularPair[]> {
  const qids = [
    ...new Set(POPULAR_PAIR_QIDS.flatMap((pair) => [pair.a, pair.b])),
  ];

  const entries = await Promise.all(
    qids.map(async (qid): Promise<readonly [string, Club | undefined]> => {
      const [club] = await deps.clubs.findByWikidataIds([qid]);
      return [qid, club];
    }),
  );
  const byQid = new Map(entries);

  return POPULAR_PAIR_QIDS.flatMap((pair) => {
    const a = byQid.get(pair.a);
    const b = byQid.get(pair.b);
    // Biri bile çözülemezse çift atlanır (yukarıdaki dürüstlük koşulu).
    if (a === undefined || b === undefined) return [];
    return [{ a: toClubDto(a), b: toClubDto(b) }];
  });
}
