import type { ReactNode } from "react";

/**
 * Mod künyesi ve skor tabelası — PROJECT.md §7.15.
 *
 * NEDEN TEK BİLEŞEN. Dört mod dört ayrı `<header>` yazıyordu ve üçü birbirinin
 * kopyasıydı: aynı `text-3xl` başlık, aynı `mt-3 text-lg text-muted` açıklama.
 * Kopya olduğu için de ayrışıyordu — biri `max-w-prose` taşıyor, diğeri
 * taşımıyordu. Ortak bir bileşen, modlar arasında ÖĞRENİLEBİLİR bir üst bant
 * kuruyor: kullanıcı hangi modda olduğunu hep aynı yerden okuyor.
 *
 * BAŞLIK KÜÇÜLDÜ, SAYI BÜYÜDÜ. Önceki düzende en büyük tipografi sayfa
 * başlığındaydı — yani gezinme çubuğunda zaten yazan sözcüğün tekrarında.
 * Bu üründe her ekran bir sayıya bakıyor (55 ortak oyuncu, 2/9, %62, Seri 7);
 * ölçek onlara verildi. Başlık 26 pt, tabeladaki canlı sayı 30 pt.
 *
 * TABELA İSTEĞE BAĞLI. Gösterecek gerçek bir sayısı olmayan mod tabela
 * taşımaz — boş ya da uydurma bir sayaç, sayacın kendisini anlamsızlaştırır.
 *
 * ÜST ETİKET DE İSTEĞE BAĞLI. Bir süre "Mod 1 · Kesişim", "Mod 2 · Matris"
 * gibi numaralı adlar taşıdı ve bunlar hiçbir işe yaramıyordu: modun adı hem
 * gezinme şeridinde hem hemen altındaki `h1`'de zaten yazılı, "Kesişim" gibi
 * ikinci bir ad ise kullanıcının hiçbir yerde karşılaşmadığı iç terminoloji.
 * Numaralandırma da yanlış bir şey söylüyordu: modlar SIRALI değil, birbirinin
 * alternatifi. Alan yalnızca gerçekten bilgi taşıyan yerlerde doluyor — günlük
 * modlarda turun TARİHİ orada duruyor ve başka hiçbir yerde yazmıyor (BR-11).
 */

export interface ModeHeaderProps {
  /**
   * Başlığın üstündeki küçük satır — yalnızca gerçek bilgi için.
   *
   * Modun adını buraya yazmayın: `title` zaten o. Günlük turlarda tarih için,
   * başka bir şey için değil.
   */
  readonly eyebrow?: string;
  /** Modun adı — sayfanın tek `h1`'i. */
  readonly title: string;
  /** Ne yapılacağını söyleyen cümle. Süsleme değil, görev tarifi. */
  readonly task: ReactNode;
  /** Sağdaki tabela; yoksa künye tek başına durur. */
  readonly scoreboard?: ReactNode;
}

export function ModeHeader({
  eyebrow,
  title,
  task,
  scoreboard,
}: ModeHeaderProps) {
  return (
    <header className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b-2 border-foreground pb-4">
      <div className="min-w-0 flex-1 basis-72">
        {/* Boşluk etiketin ÜZERİNDE değil ALTINDA: etiket yokken başlık
            künyenin tepesine oturuyor, ölü bir aralık kalmıyor. */}
        {eyebrow !== undefined && (
          <p className="mb-1 text-[0.65rem] font-extrabold tracking-[0.15em] text-muted uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-balance sm:text-[1.625rem]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted">{task}</p>
      </div>

      {scoreboard}
    </header>
  );
}

/**
 * Tabeladaki tek hücre.
 *
 * `tone` SONUÇ dilinden gelir (doğru/yanlış/orta) ya da vurgudur; ayrımın
 * kendisi §7.12'de: `accent` kaydın dili, `correct`/`wrong`/`warn` sonucun.
 */
export interface ScoreCell {
  readonly label: string;
  readonly value: string;
  readonly tone?: "accent" | "correct" | "wrong" | "warn";
  /**
   * Uzun sayılar için küçük punto.
   *
   * "132.263" otuz puntoda tabelayı taşırıyor. Ölçüyü küçültmek, sayıyı
   * kısaltmaktan ("132 bin") iyidir: yuvarlanmış bir sayı, ölçülmüş bir
   * sayı gibi görünür ama değildir (§2.7).
   */
  readonly small?: boolean;
}

const TONE_CLASS: Record<NonNullable<ScoreCell["tone"]>, string> = {
  accent: "text-accent",
  correct: "text-correct",
  wrong: "text-wrong",
  warn: "text-warn",
};

export interface ScoreboardProps {
  readonly cells: readonly ScoreCell[];
  /**
   * Canlı bir sonuç var mı? Varsa tabela vurgulanır.
   *
   * Boş durumdaki tabela ile sonuç gelmiş tabela AYNI görünmemeli: sonucun
   * geldiği an bir olaydır ve bugünkü arayüzün en çok eleştirilen yanı tam
   * olarak o anın sessiz geçmesiydi.
   */
  readonly lit?: boolean;
  /** Ekran okuyucuya tabelanın ne olduğunu söyler. */
  readonly label: string;
}

export function Scoreboard({ cells, lit = false, label }: ScoreboardProps) {
  return (
    <div
      // `group` DEĞİL `region` DEĞİL: tabela bir gezinme hedefi değil, künyenin
      // parçası. `aria-label`'lı bir liste, ekran okuyucuya "Ortak oyuncu 55"
      // ikilisini etiket-değer olarak veriyor.
      role="group"
      aria-label={label}
      className={
        "flex shrink-0 overflow-hidden rounded-xl border shadow-card " +
        (lit ? "border-accent bg-accent-soft" : "border-line-strong bg-surface")
      }
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          // Dar ekranda üç hücre + dolgu 390 px'i zorluyor; ölçüler orada
          // küçülüyor. Sayı KISALTILMIYOR (§2.7) — yalnızca punto iniyor.
          className="min-w-[3.5rem] border-r border-line px-2.5 py-2 text-right last:border-r-0 sm:min-w-[4.75rem] sm:px-4"
        >
          <p className="text-[0.6rem] font-extrabold tracking-[0.13em] text-muted uppercase">
            {cell.label}
          </p>
          <p
            className={
              "font-extrabold tabular-nums " +
              (cell.small
                ? "pt-1.5 text-base tracking-tight sm:text-lg"
                : "text-2xl leading-none tracking-[-0.035em] sm:text-3xl") +
              (cell.tone === undefined ? "" : " " + TONE_CLASS[cell.tone])
            }
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}
