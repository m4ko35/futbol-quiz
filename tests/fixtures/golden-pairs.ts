/**
 * Altın veri seti — PROJECT.md §8.1.
 *
 * Her satır ELLE DOĞRULANMIŞ bir futbol olgusudur: "şu oyuncu şu iki kulüpte
 * de oynadı". Kaynak genel futbol bilgisidir, veritabanının kendisi değil —
 * veritabanından türetilmiş bir "altın" set yalnızca kendini doğrular.
 *
 * NEDEN QID: kimlikler kulüp ve oyuncu için Wikidata QID'i ile sabitlenir,
 * adla değil. Faz 1 boyunca üç kez ada güvenip yanıldık; en son burada, altın
 * seti kurarken: `name contains "Shevchenko"` hiçbir şey bulmadı, çünkü kayıt
 * Türkçe etiketiyle "Andriy Şevçenko" olarak duruyor. Ad bir gösterim
 * ayrıntısıdır ve dile, alfabeye, düzenlemeye göre değişir; QID değişmez.
 */

/** Kısaltmalar okunabilirlik için; test QID kullanır. */
export const CLUBS = {
  GS: "Q495299", // Galatasaray
  FB: "Q6601875", // Fenerbahçe
  BJK: "Q172567", // Beşiktaş
  ARS: "Q9617", // Arsenal
  CHE: "Q9616", // Chelsea
  LIV: "Q1130849", // Liverpool
  EVE: "Q5794", // Everton
  MUN: "Q18656", // Manchester United
  MCI: "Q50602", // Manchester City
  RMA: "Q8682", // Real Madrid
  ATM: "Q8701", // Atlético Madrid
  BAR: "Q7156", // Barcelona
  INT: "Q631", // Internazionale
  MIL: "Q1543", // A.C. Milan
  JUV: "Q1422", // Juventus
  BAY: "Q15789", // Bayern München
  BVB: "Q41420", // Borussia Dortmund
  PSG: "Q483020", // Paris Saint-Germain
} as const;

export interface GoldenFact {
  /** Kulüp A'nın Wikidata QID'i. */
  readonly a: string;
  readonly b: string;
  /** Bu çiftte MUTLAKA bulunması gereken oyuncunun QID'i. */
  readonly player: string;
  /** Yalnızca test çıktısını okunabilir kılmak için; eşleşmede kullanılmaz. */
  readonly name: string;
}

/**
 * Bulunması ZORUNLU oyuncular (31 olgu, 27 kulüp çifti).
 *
 * Bu liste ÇAĞRI (recall) ölçer: sistem bilinen bir ortaklığı kaçırıyor mu?
 */
export const GOLDEN_FACTS: readonly GoldenFact[] = [
  { a: CLUBS.GS, b: CLUBS.ARS, player: "Q192856", name: "Emmanuel Eboué" },
  { a: CLUBS.GS, b: CLUBS.ARS, player: "Q134976", name: "Lukas Podolski" },
  { a: CLUBS.GS, b: CLUBS.INT, player: "Q124086", name: "Wesley Sneijder" },
  { a: CLUBS.GS, b: CLUBS.INT, player: "Q192974", name: "Hakan Şükür" },
  { a: CLUBS.GS, b: CLUBS.CHE, player: "Q48892", name: "Didier Drogba" },
  { a: CLUBS.GS, b: CLUBS.ATM, player: "Q487459", name: "Arda Turan" },
  { a: CLUBS.BAR, b: CLUBS.RMA, player: "Q483145", name: "Luís Figo" },
  { a: CLUBS.MUN, b: CLUBS.RMA, player: "Q11571", name: "Cristiano Ronaldo" },
  { a: CLUBS.LIV, b: CLUBS.RMA, player: "Q128829", name: "Michael Owen" },
  { a: CLUBS.LIV, b: CLUBS.RMA, player: "Q208104", name: "Xabi Alonso" },
  { a: CLUBS.ATM, b: CLUBS.LIV, player: "Q42731", name: "Fernando Torres" },
  { a: CLUBS.ARS, b: CLUBS.BAR, player: "Q45901", name: "Thierry Henry" },
  { a: CLUBS.ARS, b: CLUBS.BAR, player: "Q184177", name: "Thomas Vermaelen" },
  { a: CLUBS.MIL, b: CLUBS.CHE, player: "Q41244", name: "Andriy Şevçenko" },
  { a: CLUBS.MIL, b: CLUBS.INT, player: "Q484909", name: "Clarence Seedorf" },
  { a: CLUBS.RMA, b: CLUBS.FB, player: "Q429039", name: "Roberto Carlos" },
  { a: CLUBS.RMA, b: CLUBS.BJK, player: "Q194461", name: "Guti Hernández" },
  { a: CLUBS.RMA, b: CLUBS.ARS, player: "Q83488", name: "Mesut Özil" },
  { a: CLUBS.BAR, b: CLUBS.INT, player: "Q46896", name: "Zlatan Ibrahimović" },
  { a: CLUBS.JUV, b: CLUBS.INT, player: "Q46896", name: "Zlatan Ibrahimović" },
  { a: CLUBS.BAR, b: CLUBS.MIL, player: "Q46896", name: "Zlatan Ibrahimović" },
  { a: CLUBS.CHE, b: CLUBS.BAY, player: "Q43913", name: "Arjen Robben" },
  { a: CLUBS.BAY, b: CLUBS.BAR, player: "Q151269", name: "Robert Lewandowski" },
  { a: CLUBS.BVB, b: CLUBS.BAY, player: "Q151269", name: "Robert Lewandowski" },
  { a: CLUBS.MUN, b: CLUBS.MCI, player: "Q50600", name: "Carlos Tévez" },
  { a: CLUBS.MUN, b: CLUBS.JUV, player: "Q129027", name: "Paul Pogba" },
  { a: CLUBS.ARS, b: CLUBS.MUN, player: "Q2339", name: "Robin van Persie" },
  { a: CLUBS.PSG, b: CLUBS.BAR, player: "Q142794", name: "Neymar" },
  { a: CLUBS.CHE, b: CLUBS.RMA, player: "Q214204", name: "Eden Hazard" },
  { a: CLUBS.LIV, b: CLUBS.CHE, player: "Q42731", name: "Fernando Torres" },
  { a: CLUBS.ARS, b: CLUBS.CHE, player: "Q483137", name: "Petr Čech" },
];

/**
 * Dondurulmuş sayımlar — 2026-07-29 tarihli veri kümesinden ÖLÇÜLDÜ.
 *
 * DİKKAT: bunlar "doğru cevap" DEĞİL, o günkü cevaptır. Amaçları gerileme
 * yakalamak: sorgu mantığı bozulduğunda sayı sessizce değişir ve bu test
 * bağırır. ETL yeniden çalıştıktan sonra sayıların bir miktar oynaması
 * beklenir; o yüzden eşleşme tam değil, tolerans aralığıyladır.
 */
export const FROZEN_COUNTS: readonly {
  a: string;
  b: string;
  count: number;
  label: string;
}[] = [
  { a: CLUBS.LIV, b: CLUBS.EVE, count: 51, label: "Liverpool ∩ Everton" },
  { a: CLUBS.FB, b: CLUBS.BJK, count: 41, label: "Fenerbahçe ∩ Beşiktaş" },
  { a: CLUBS.GS, b: CLUBS.FB, count: 62, label: "Galatasaray ∩ Fenerbahçe" },
  { a: CLUBS.MIL, b: CLUBS.INT, count: 128, label: "Milan ∩ Inter" },
  { a: CLUBS.BAR, b: CLUBS.RMA, count: 49, label: "Barcelona ∩ Real Madrid" },
  { a: CLUBS.MUN, b: CLUBS.MCI, count: 76, label: "Man Utd ∩ Man City" },
];

/** Dondurulmuş sayımlarda kabul edilen sapma oranı. */
export const COUNT_TOLERANCE = 0.15;
