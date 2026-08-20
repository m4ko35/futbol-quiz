import type { ScoredAnswerDto } from "@/application/use-cases/answer-names";
import type { RoomDto, RoomSideDto } from "@/application/use-cases/rooms";
import type { StatDto } from "@/application/use-cases/daily-stat-match";
import type { StatKey } from "@/domain/services/stat-match";

/**
 * Oda sonucu — iki turun YAN YANA karşılaştırması (PROJECT.md §12, BR-62).
 *
 * BU EKRAN ODANIN TEK ÖDÜLÜ. BR-60 gereği sonuç hiçbir yerde birikmiyor:
 * lider tablosuna girmiyor, geçmişte durmuyor, bir saat sonra satırın kendisi
 * siliniyor. Geriye kalan tek şey iki oyuncunun o an ekranda gördüğü bu
 * karşılaştırma — bu yüzden özet bir skordan ibaret olamaz. "Kaybettim" bilgisi
 * tek başına hiçbir şey öğretmez; "aynı 435 maça sen Xavi yazdın, o Pirlo
 * yazdı" öğretir.
 *
 * SUNUCU BİLEŞENİ. Yoklama, kopyalama, geri sayım — hepsi `RoomBoard`'ın işi;
 * burada durum yok. Bu ayrım testi de kolaylaştırıyor: karşılaştırma tablosu
 * sahte bir DTO ile doğrudan çizilebiliyor.
 */

export interface RoomResultProps {
  /** Yalnızca `bitti` durumundaki oda; `target` ve iki taraf da dolu. */
  readonly room: RoomDto;
}

/** Puan bandına göre rozet rengi — `stat-match-game.tsx` ile aynı eşikler. */
function scoreTone(score: number): string {
  if (score >= 80) return "bg-correct-soft text-correct";
  if (score >= 50) return "bg-warn-soft text-warn";
  return "bg-wrong-soft text-wrong";
}

function byStat(
  answers: readonly ScoredAnswerDto[] | null,
): ReadonlyMap<StatKey, ScoredAnswerDto> {
  return new Map((answers ?? []).map((answer) => [answer.statKey, answer]));
}

export function RoomResult({ room }: RoomResultProps) {
  const target = room.target;
  const opponent = room.opponent;

  /**
   * EKSİK VERİ SESSİZCE ÇİZİLMEZ. `bitti` durumu hedefi ve iki tarafı
   * garanti ediyor; yine de tip düzeyinde `null` olabildikleri için bu dal
   * duruyor. Boş bir tablo çizmek yerine hiçbir şey çizmemek doğru: eksik
   * olan şey tam da ekranın konusu.
   */
  if (target === null || opponent === null) return null;

  const mine = byStat(room.me.answers);
  const theirs = byStat(opponent.answers);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold tracking-tight">
        İstatistik istatistik
      </h2>

      <ul className="flex flex-col gap-3">
        {target.stats.map((stat) => (
          <ResultRow
            key={stat.key}
            stat={stat}
            meName={room.me.displayName}
            opponentName={opponent.displayName}
            mine={mine.get(stat.key)}
            theirs={theirs.get(stat.key)}
          />
        ))}
      </ul>

      {/*
        BR-60'IN KENDİSİ YAZILI. Kullanıcı bu ekranı bir yere kaydedileceğini
        sanarsa, bir saat sonra geri dönüp aradığında kaybını bize yazar.
        Söylenmemiş bir kural, kırılmış bir sözdür.
      */}
      <p className="text-xs text-muted">
        Bu sonuç hiçbir yerde saklanmıyor: lider tablosuna girmez ve oda kısa
        süre sonra silinir. Ekranı şimdi paylaşın.
      </p>
    </section>
  );
}

interface ResultRowProps {
  readonly stat: StatDto;
  readonly meName: string;
  readonly opponentName: string;
  readonly mine: ScoredAnswerDto | undefined;
  readonly theirs: ScoredAnswerDto | undefined;
}

function ResultRow({
  stat,
  meName,
  opponentName,
  mine,
  theirs,
}: ResultRowProps) {
  const myScore = mine?.score ?? -1;
  const theirScore = theirs?.score ?? -1;

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          {stat.label}
          {stat.scoped && (
            <>
              <span aria-hidden="true">*</span>
              <span className="sr-only"> (yalnızca yirmi dört lig)</span>
            </>
          )}
        </span>
        <span className="text-2xl font-bold text-accent tabular-nums">
          {String(stat.value)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <ResultSide
          who={meName}
          answer={mine}
          /*
            SATIRIN GALİBİ KALIN YAZILIYOR ve renk TEK GÖSTERGE DEĞİL
            (WCAG 1.4.1): iki yüzde de rozetlerin metninde okunuyor, üstünlük
            oradan da anlaşılıyor. Kalınlık yalnızca gözü hızlandırıyor.
          */
          leads={myScore > theirScore}
        />
        <ResultSide
          who={opponentName}
          answer={theirs}
          leads={theirScore > myScore}
        />
      </div>
    </li>
  );
}

function ResultSide({
  who,
  answer,
  leads,
}: {
  readonly who: string;
  readonly answer: ScoredAnswerDto | undefined;
  readonly leads: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-xs font-semibold tracking-wide text-muted uppercase">
          {who}
        </span>
        <span className={"truncate " + (leads ? "font-bold" : "font-medium")}>
          {answer?.playerName ?? "—"}
        </span>
      </span>

      {answer !== undefined && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreTone(
            answer.score,
          )}`}
        >
          {String(answer.value)} · %{String(answer.score)}
        </span>
      )}
    </div>
  );
}

/** Tabelada gösterilecek taraf özeti — `RoomBoard` ile paylaşılıyor. */
export function sidePoints(side: RoomSideDto): string {
  return side.points === null ? "—" : String(side.points);
}
