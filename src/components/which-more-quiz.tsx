"use client";

import { useCallback, useState } from "react";
import type {
  WhichMoreAnswerDto,
  WhichMorePairDto,
  WhichMorePlayerDto,
  WhichMoreRoundDto,
} from "@/application/use-cases/which-more";
import { ModeHeader, Scoreboard } from "./mode-header";
import { STAT_KEYS, type StatKey } from "@/domain/services/stat-match";
import type { Direction } from "@/domain/services/which-more";

/**
 * "Hangisi daha" oyunu — PROJECT.md §9.3.
 *
 * KOŞU DURUMU BURADA. Sunucu her turu tek tek kurar ve her cevabı tek tek
 * doğrular ama koşuyu hatırlamaz (§9.3); seri sayacı, görülen oyuncular ve
 * seçilen istatistik bu bileşende yaşar.
 *
 * CEVAPTAN SONRA OTOMATİK GEÇİŞ YOK. Zamanlayıcıyla ilerleyen bir oyun,
 * WCAG 2.1'in "Timing Adjustable" ölçütüne takılırdı (§7.10) ve sonucu okumaya
 * fırsat bırakmazdı. Kullanıcı "Devam" diyerek ilerler.
 */

interface StatQuestion {
  readonly key: StatKey;
  /** Seçim ekranındaki ad. */
  readonly name: string;
  /** "Hangisi …?" cümlesini tamamlar. */
  readonly more: string;
  readonly less: string;
  /** Değerin yanına yazılan birim. */
  readonly unit: string;
  /** §9.2'nin kapsam bildirimi: yalnızca 24 ligi mi sayıyor? */
  readonly scoped: boolean;
}

/**
 * Etiketler SUNUM tarafındadır (§6.5): anahtarlar sözleşmenin parçası, bu
 * cümleler değil. Yön başına ayrı cümle var çünkü Türkçede "daha az uzun"
 * diye bir şey yok — karşıtı "daha kısa".
 */
const QUESTIONS: readonly StatQuestion[] = [
  {
    key: "appearances",
    name: "Kulüp maçı",
    more: "daha çok kulüp maçı yaptı",
    less: "daha az kulüp maçı yaptı",
    unit: "maç",
    scoped: true,
  },
  {
    key: "goals",
    name: "Kulüp golü",
    more: "daha çok kulüp golü attı",
    less: "daha az kulüp golü attı",
    unit: "gol",
    scoped: true,
  },
  {
    key: "clubs",
    name: "Oynadığı kulüp",
    more: "daha çok kulüpte oynadı",
    less: "daha az kulüpte oynadı",
    unit: "kulüp",
    scoped: true,
  },
  {
    key: "nationalCaps",
    name: "A millî maç",
    more: "daha çok A millî maça çıktı",
    less: "daha az A millî maça çıktı",
    unit: "millî maç",
    scoped: false,
  },
  {
    key: "heightCm",
    name: "Boy",
    more: "daha uzun",
    less: "daha kısa",
    unit: "cm",
    scoped: false,
  },
  {
    key: "weightKg",
    name: "Kilo",
    more: "daha ağır",
    less: "daha hafif",
    unit: "kg",
    scoped: false,
  },
];

function questionFor(key: StatKey): StatQuestion {
  // STAT_KEYS ile QUESTIONS aynı altı anahtarı taşır; bulunamama hâli tip
  // düzeyinde imkânsız ama `noUncheckedIndexedAccess` altında kanıtlanmalı.
  const found = QUESTIONS.find((one) => one.key === key);
  if (found === undefined) throw new Error(`Etiketsiz istatistik: ${key}`);
  return found;
}

type Phase =
  | { readonly kind: "setup" }
  | { readonly kind: "loading" }
  | { readonly kind: "asking"; readonly pair: WhichMorePairDto }
  | {
      readonly kind: "revealed";
      readonly pair: WhichMorePairDto;
      readonly answer: WhichMoreAnswerDto;
      /**
       * Kullanıcının TIKLADIĞI oyuncu.
       *
       * Sunucu cevabında yok ve olması da gerekmiyor — sunucu "hangisi
       * kazandı"yı söylüyor, "sen ne seçtin"i değil. Ama arayüzde gerekli:
       * yanlış cevapta iki panelde de sayı açılıyor ve kullanıcı hangisine
       * tıkladığını yalnızca renkten ÇIKARSAMAK zorunda kalıyordu.
       */
      readonly chosenId: string;
    }
  /** Havuz tükendi (§6.6) — yanlış cevaptan farklı bir son. */
  | { readonly kind: "exhausted" }
  | { readonly kind: "error"; readonly message: string };

export interface WhichMoreQuizProps {
  /** Testler gerçek ağa çıkmasın diye enjekte edilebilir. */
  fetchRound?(body: unknown): Promise<WhichMoreRoundDto>;
  fetchAnswer?(body: unknown): Promise<WhichMoreAnswerDto>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Sunucu mesajı §6.3 gereği kullanıcıya gösterilebilir; yoksa genel metin.
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(messageOf(payload) ?? "İstek tamamlanamadı.");
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

function messageOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export function WhichMoreQuiz({
  fetchRound = (body) => postJson("/api/hangisi-daha/round", body),
  fetchAnswer = (body) => postJson("/api/hangisi-daha/answer", body),
}: WhichMoreQuizProps) {
  const [statKey, setStatKey] = useState<StatKey>("appearances");
  const [direction, setDirection] = useState<Direction>("more");
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [streak, setStreak] = useState(0);
  /** BR-28 — aynı oyuncu ikinci kez sunulmaz. */
  const [seen, setSeen] = useState<readonly string[]>([]);

  const question = questionFor(statKey);

  const loadRound = useCallback(
    async (
      key: StatKey,
      stayingId: string | null,
      exclude: readonly string[],
    ) => {
      setPhase({ kind: "loading" });
      try {
        const round = await fetchRound({
          statKey: key,
          ...(stayingId === null ? {} : { stayingId }),
          exclude,
        });

        if (round.pair === null) {
          setPhase({ kind: "exhausted" });
          return;
        }
        setSeen([...exclude, round.pair.left.id, round.pair.right.id]);
        setPhase({ kind: "asking", pair: round.pair });
      } catch (error: unknown) {
        setPhase({ kind: "error", message: describe(error) });
      }
    },
    [fetchRound],
  );

  async function choose(chosenId: string): Promise<void> {
    if (phase.kind !== "asking") return;
    const { pair } = phase;

    try {
      const answer = await fetchAnswer({
        statKey,
        direction,
        leftId: pair.left.id,
        rightId: pair.right.id,
        chosenId,
      });

      if (answer.correct) setStreak((current) => current + 1);
      setPhase({ kind: "revealed", pair, answer, chosenId });
    } catch (error: unknown) {
      setPhase({ kind: "error", message: describe(error) });
    }
  }

  function start(): void {
    setStreak(0);
    setSeen([]);
    void loadRound(statKey, null, []);
  }

  function restart(): void {
    setPhase({ kind: "setup" });
    setStreak(0);
    setSeen([]);
  }

  /*
    KÜNYE HER İKİ EVREDE DE BASILIR (§7.15).

    Bileşen kurulum evresinde erken dönüyor; künye tek bir dalda kalsaydı
    kullanıcı istatistik seçerken sayfanın hangi mod olduğunu söyleyen bant
    kaybolurdu. Seri sayacı buradan geliyor — sunucu sayfası onu bilemezdi.

    Kurulumda tabela YOK: henüz sayılacak bir şey yok ve sıfır gösteren bir
    sayaç, sayacın kendisini anlamsızlaştırır.
  */
  const modeHeader = (
    <ModeHeader
      eyebrow="Mod 4 · Düello"
      title="Hangisi Daha"
      task={
        <>
          Bir istatistik seç, iki futbolcudan hangisinin önde olduğunu bul.
          Doğru bildiğin sürece seçtiğin oyuncu kalır;{" "}
          <strong className="font-semibold text-foreground">
            bir yanlış koşuyu bitirir
          </strong>
          .
        </>
      }
      scoreboard={
        phase.kind === "setup" ? undefined : (
          <Scoreboard
            label="Koşu durumu"
            lit={streak > 0}
            cells={[
              {
                label: "Seri",
                value: String(streak),
                tone: streak > 0 ? "accent" : undefined,
              },
            ]}
          />
        )
      }
    />
  );

  if (phase.kind === "setup") {
    return (
      <div className="flex flex-col gap-6">
        {modeHeader}
        <StatPicker
          statKey={statKey}
          direction={direction}
          onStatKey={setStatKey}
          onDirection={setDirection}
          onStart={start}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">{modeHeader}</div>

      <h2 className="text-xl font-semibold tracking-tight">
        Hangisi {direction === "more" ? question.more : question.less}?
      </h2>

      {question.scoped && (
        <p className="text-sm text-muted">
          Bu sayı yalnızca kapsamdaki 24 ligi sayar.
        </p>
      )}

      {phase.kind === "loading" && (
        <p className="text-muted" role="status">
          Eşleşme hazırlanıyor…
        </p>
      )}

      {phase.kind === "error" && (
        <ErrorPanel message={phase.message} onRestart={restart} />
      )}

      {phase.kind === "exhausted" && (
        <OverPanel
          title="Havuz tükendi"
          detail="Bu istatistikte sunulabilecek yeni bir eşleşme kalmadı."
          streak={streak}
          onRestart={restart}
        />
      )}

      {(phase.kind === "asking" || phase.kind === "revealed") && (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {(["left", "right"] as const).map((side) => {
              const player = phase.pair[side];
              const revealed =
                phase.kind === "revealed" ? phase.answer[side].value : null;

              return (
                <li key={player.id}>
                  <PlayerCard
                    player={player}
                    unit={question.unit}
                    value={revealed}
                    outcome={
                      phase.kind === "revealed"
                        ? outcomeFor(phase.answer, player.id)
                        : "none"
                    }
                    chosen={
                      phase.kind === "revealed" && phase.chosenId === player.id
                    }
                    fate={
                      // Yalnızca doğru cevapta: yanlışta koşu bitiyor ve
                      // kimse "kalmıyor".
                      phase.kind === "revealed" && phase.answer.correct
                        ? phase.answer.winnerId === player.id
                          ? "stays"
                          : "out"
                        : null
                    }
                    disabled={phase.kind !== "asking"}
                    onChoose={() => void choose(player.id)}
                  />
                </li>
              );
            })}
          </ul>

          {/*
            SONUÇ CANLI BÖLGEDE. Doğru/yanlış yalnızca renkle anlatılsaydı
            ekran okuyucu kullanıcısı hiçbir şey duymazdı (§7.10).
          */}
          <div aria-live="polite">
            {phase.kind === "revealed" &&
              (phase.answer.correct ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold text-correct">Doğru!</p>
                  <button
                    type="button"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => {
                      void loadRound(statKey, phase.answer.winnerId, seen);
                    }}
                  >
                    Devam
                  </button>
                </div>
              ) : (
                <OverPanel
                  title="Yanlış"
                  detail="Koşu burada bitti."
                  streak={streak}
                  onRestart={restart}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Bir kartın açıldıktan sonraki durumu.
 *
 * "wrong" YALNIZCA kullanıcının seçtiği yanlış karta verilir. Doğru cevabı
 * bulamayan kartı da kırmızıya boyamak, iki kırmızı kart gösterip hangisinin
 * kullanıcının hatası olduğunu belirsizleştirirdi.
 */
type Outcome = "none" | "correct" | "wrong";

function outcomeFor(answer: WhichMoreAnswerDto, playerId: string): Outcome {
  if (answer.winnerId === playerId) return "correct";
  return answer.correct ? "none" : "wrong";
}

const OUTCOME_CLASS: Readonly<Record<Outcome, string>> = {
  none: "border-line-strong bg-background",
  correct: "border-correct bg-correct-soft",
  wrong: "border-wrong bg-wrong-soft",
};

interface PlayerCardProps {
  readonly player: WhichMorePlayerDto;
  readonly unit: string;
  /** `null` = değer henüz açılmadı (BR-32). */
  readonly value: number | null;
  readonly outcome: Outcome;
  /** Kullanıcı bu paneli mi tıkladı? Yalnızca değerler açıldıktan sonra. */
  readonly chosen: boolean;
  /**
   * Zincirde ne olacağı — yalnızca DOĞRU cevapta anlamlı.
   *
   * Yanlış cevapta koşu bitiyor; "kalıyor"/"eleniyor" demek orada yanlış
   * olurdu, çünkü kimse kalmıyor.
   */
  readonly fate: "stays" | "out" | null;
  readonly disabled: boolean;
  onChoose(): void;
}

function PlayerCard({
  player,
  unit,
  value,
  outcome,
  chosen,
  fate,
  disabled,
  onChoose,
}: PlayerCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      className={`flex w-full flex-col items-start gap-2 rounded-xl border-2 px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${
        value === null
          ? "border-line-strong bg-background enabled:hover:border-accent enabled:hover:bg-accent-soft"
          : OUTCOME_CLASS[outcome]
      }`}
    >
      <span className="text-lg font-semibold">{player.name}</span>
      <span className="text-sm text-muted">{player.clubs.join(" · ")}</span>
      <span className="text-2xl font-bold tabular-nums">
        {value === null ? (
          <span aria-label="değer gizli">—</span>
        ) : (
          `${String(value)} ${unit}`
        )}
      </span>

      {/*
        SEÇİM VE AKIBET AÇIKÇA YAZILI.

        Değerler açıldığında iki panelde de bir sayı duruyor ve kullanıcı hangi
        panele tıkladığını yalnızca RENKTEN çıkarsamak zorundaydı — yanlış
        cevapta "kırmızı olan benim seçimimdi" diye. Çıkarsama renk ayırt
        edemeyen kullanıcıda hiç kurulmuyordu (WCAG 1.4.1) ve doğru cevapta
        zaten hiç kurulmuyordu: orada iki panel de "yanlış" değil.

        `fate` ise bir sonraki adımı söylüyor. Zincirin kuralı — kazanan kalır,
        diğeri elenir — bugün yalnızca yardım metninde yazılıydı; olduğu anda
        gösterilmiyordu.
      */}
      {(chosen || fate !== null) && (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
          {chosen && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-accent-fg">
              senin seçimin
            </span>
          )}
          {fate !== null && (
            <span
              className={
                fate === "stays" ? "text-correct" : "text-muted line-through"
              }
            >
              {fate === "stays" ? "kalıyor" : "eleniyor"}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

interface OverPanelProps {
  readonly title: string;
  readonly detail: string;
  readonly streak: number;
  onRestart(): void;
}

function OverPanel({ title, detail, streak, onRestart }: OverPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-4">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-muted">{detail}</p>
      <p>
        Skorun:{" "}
        <span className="text-2xl font-bold tabular-nums">{streak}</span> doğru
      </p>
      <div>
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onRestart}
        >
          Yeniden başla
        </button>
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onRestart,
}: {
  readonly message: string;
  onRestart(): void;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3">
      <p className="text-wrong">{message}</p>
      <div>
        <button
          type="button"
          className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onRestart}
        >
          Yeniden başla
        </button>
      </div>
    </div>
  );
}

interface StatPickerProps {
  readonly statKey: StatKey;
  readonly direction: Direction;
  onStatKey(key: StatKey): void;
  onDirection(direction: Direction): void;
  onStart(): void;
}

function StatPicker({
  statKey,
  direction,
  onStatKey,
  onDirection,
  onStart,
}: StatPickerProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Hangi istatistik?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {STAT_KEYS.map((key) => {
            const one = questionFor(key);
            const isCurrent = key === statKey;
            return (
              <label
                key={key}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                  isCurrent
                    ? "border-accent bg-accent-soft"
                    : "border-line-strong bg-background hover:border-accent"
                }`}
              >
                <input
                  type="radio"
                  name="which-more-stat"
                  className="sr-only"
                  value={key}
                  checked={isCurrent}
                  onChange={() => {
                    onStatKey(key);
                  }}
                />
                {one.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-sm font-semibold">Hangi yön?</legend>
        {(["more", "less"] as const).map((option) => {
          const one = questionFor(statKey);
          const isCurrent = option === direction;
          return (
            <label
              key={option}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                isCurrent
                  ? "border-accent bg-accent-soft"
                  : "border-line-strong bg-background hover:border-accent"
              }`}
            >
              <input
                type="radio"
                name="which-more-direction"
                className="sr-only"
                value={option}
                checked={isCurrent}
                onChange={() => {
                  onDirection(option);
                }}
              />
              {option === "more" ? one.more : one.less}
            </label>
          );
        })}
      </fieldset>

      <div>
        <button
          type="button"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onStart}
        >
          Başla
        </button>
      </div>
    </div>
  );
}

function describe(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Beklenmeyen bir hata oluştu.";
}
