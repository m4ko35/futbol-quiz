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
 *
 * SAHNE CSS'TE, ZAMANLAYICIDA DEĞİL. Kartların sırayla belirmesi ve değerlerin
 * yenilenden kazanana doğru açılması yalnızca `animation-delay` ile kuruluyor:
 * bilginin tamamı ilk karede DOM'a giriyor, geciken yalnızca görüntü. Bir
 * `setTimeout` kurgusu aynı görüntüyü verirdi ama sonucu ekran okuyucudan da
 * geciktirirdi ve `prefers-reduced-motion` onu kaldıramazdı (§7.10).
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
  /**
   * Bir önceki turdan KALAN oyuncu; ilk turda `null`.
   *
   * Sunucu bunu geri söylemiyor ve söylemesi de gerekmiyor — biz sorduk, biz
   * biliyoruz. Ama arayüzde gerekli: BR-28'in "kazanan kalır" kuralı bugüne
   * dek yalnızca giriş metninde yazıyordu, turun kendisinde hangi kartın
   * kaldığı hiçbir yerde görünmüyordu.
   */
  const [keptId, setKeptId] = useState<string | null>(null);

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
        setKeptId(stayingId);
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
    setKeptId(null);
    void loadRound(statKey, null, []);
  }

  function restart(): void {
    setPhase({ kind: "setup" });
    setStreak(0);
    setSeen([]);
    setKeptId(null);
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

      {/*
        SORU SAHNENİN BAŞLIĞIDIR. Önceki ölçüsü (`text-xl`) künyedeki mod
        adından küçüktü; oysa kullanıcının her turda okuduğu tek cümle bu.

        Kapsam notu `note` rolünde, `muted` değil (§7.12): bu bir ikincil
        açıklama değil, kaynağın nereye kadar saydığını söyleyen bir kenar
        notu — §5.2'nin dürüstlük metinleriyle aynı sınıf.
      */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
          Hangisi {direction === "more" ? question.more : question.less}?
        </h2>

        {question.scoped && (
          <p className="text-sm text-note">
            Bu sayı yalnızca kapsamdaki 24 ligi sayar.
          </p>
        )}
      </div>

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
          tone="note"
          onRestart={restart}
        />
      )}

      {(phase.kind === "asking" || phase.kind === "revealed") && (
        <>
          <ul className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            {(["left", "right"] as const).map((side, index) => {
              const player = phase.pair[side];
              const revealed =
                phase.kind === "revealed" ? phase.answer[side].value : null;

              // Zincirdeki yer yalnızca SORULURKEN gösteriliyor: cevap
              // açıldığında kartlar zaten "senin seçimin" / "kalıyor" /
              // "eleniyor" taşıyor ve dördüncü bir rozet gürültü olurdu.
              const chain: ChainRole =
                phase.kind === "asking" && keptId !== null
                  ? player.id === keptId
                    ? "kept"
                    : "new"
                  : null;

              return (
                <li
                  key={player.id}
                  className="animate-duel-enter relative"
                  // Kalan kart ÖNCE, yeni rakip sonra beliriyor; sıralamanın
                  // kendisi BR-28'i anlatıyor. İlk turda zincir yok, iki kart
                  // soldan sağa hafif kaydırmayla giriyor.
                  style={{
                    animationDelay: `${String(
                      chain === null ? index * 70 : chain === "new" ? 110 : 0,
                    )}ms`,
                  }}
                >
                  {side === "right" && <VersusChip />}

                  <PlayerCard
                    player={player}
                    unit={question.unit}
                    value={revealed}
                    share={
                      phase.kind === "revealed"
                        ? shareOf(phase.answer, player.id)
                        : 0
                    }
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
                    chain={chain}
                    // Yenilen kart önce, kazanan sonra açılıyor: cevabın
                    // vurgusu en sonda düşsün.
                    revealDelayMs={
                      phase.kind === "revealed" &&
                      phase.answer.winnerId === player.id
                        ? REVEAL_STAGGER_MS
                        : 0
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
                <VerdictBar
                  streak={streak}
                  onContinue={() => {
                    void loadRound(statKey, phase.answer.winnerId, seen);
                  }}
                />
              ) : (
                <OverPanel
                  title="Yanlış"
                  detail="Koşu burada bitti."
                  streak={streak}
                  tone="wrong"
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

/** Kartın zincirdeki yeri (BR-28); yalnızca soru sorulurken anlamlı. */
type ChainRole = "kept" | "new" | null;

/** Kazanan kartın kaç ms sonra açılacağı — yenilen kart 0'da açılır. */
const REVEAL_STAGGER_MS = 160;

function outcomeFor(answer: WhichMoreAnswerDto, playerId: string): Outcome {
  if (answer.winnerId === playerId) return "correct";
  return answer.correct ? "none" : "wrong";
}

/**
 * Değerin, İKİ değerin büyüğüne oranı (0–1) — karşılaştırma çubuğunun boyu.
 *
 * Ölçek paylaşıldığı için aradaki açıklık bir bakışta okunuyor; her kart kendi
 * ölçeğine göre çizilseydi iki çubuk da dolu görünür ve hiçbir şey anlatmazdı.
 * Dört ondalık: değer doğrudan `style`'a yazılıyor ve kayan nokta artığı
 * DOM'da `0.5714285714285714` gibi bir dize bırakıyordu (§9.2'de aynı kusur).
 */
export function shareOf(answer: WhichMoreAnswerDto, playerId: string): number {
  const own =
    answer.left.id === playerId ? answer.left.value : answer.right.value;
  const largest = Math.max(answer.left.value, answer.right.value);
  // Gol sayısında iki değer de sıfır olabilir; bölme oradan korunuyor.
  if (largest <= 0) return 0;
  return Math.round((own / largest) * 10000) / 10000;
}

const OUTCOME_CLASS: Readonly<Record<Outcome, string>> = {
  none: "border-line-strong bg-surface",
  correct: "border-correct bg-correct-soft shadow-card",
  wrong: "border-wrong bg-wrong-soft shadow-card",
};

/** Karşılaştırma çubuğunun rengi — kartın sonucuyla aynı dili konuşur. */
const BAR_CLASS: Readonly<Record<Outcome, string>> = {
  none: "bg-line-strong",
  correct: "bg-correct",
  wrong: "bg-wrong",
};

/**
 * İki kartın arasındaki `VS` işareti.
 *
 * İKİNCİ KARTIN İÇİNDE duruyor, `<ul>`'un içinde ayrı bir düğüm olarak değil:
 * `ul` yalnızca `li` taşıyabilir ve araya bir `div` koymak liste anlamını
 * bozardı. Konum boşluğa göre veriliyor — dar ekranda üst kenara, `sm` ve
 * üstünde sol kenara — böylece tek düğüm iki düzende de boşluğun tam ortasına
 * düşüyor. `aria-hidden`: neyin neyle karşılaştırıldığını soru zaten söylüyor.
 */
function VersusChip() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-8 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-line-strong bg-surface text-[0.7rem] font-black tracking-tight ring-4 ring-background sm:top-1/2 sm:-left-9 sm:translate-x-0 sm:-translate-y-1/2"
    >
      VS
    </span>
  );
}

interface PlayerCardProps {
  readonly player: WhichMorePlayerDto;
  readonly unit: string;
  /** `null` = değer henüz açılmadı (BR-32). */
  readonly value: number | null;
  /** Karşılaştırma çubuğunun oranı (0–1); değer kapalıyken kullanılmaz. */
  readonly share: number;
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
  /** Zincirdeki yer — kalan mı, yeni rakip mi (BR-28). */
  readonly chain: ChainRole;
  /** Değerin kaç ms sonra açılacağı; sahnenin sıralaması buradan gelir. */
  readonly revealDelayMs: number;
  readonly disabled: boolean;
  onChoose(): void;
}

function PlayerCard({
  player,
  unit,
  value,
  share,
  outcome,
  chosen,
  fate,
  chain,
  revealDelayMs,
  disabled,
  onChoose,
}: PlayerCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      /*
        SEÇİLEBİLİR OLDUĞU HİSSEDİLİYOR. Kart tıklanabilirken üstüne gelince
        yükseliyor ve gölgesi büyüyor, basılınca yerine oturuyor. Yalnızca
        renk değiştiren bir düğme, bu modda ekrandaki TEK eylem olmasına
        rağmen tıklanabilir görünmüyordu.
      */
      className={`flex w-full flex-col items-start gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-[transform,box-shadow,background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${
        value === null
          ? "border-line-strong bg-surface shadow-card enabled:hover:-translate-y-0.5 enabled:hover:border-accent enabled:hover:bg-accent-soft enabled:hover:shadow-pop enabled:active:translate-y-0"
          : OUTCOME_CLASS[outcome]
      }`}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="text-lg leading-tight font-bold">{player.name}</span>

        {chain !== null && (
          <span
            className={
              "shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-extrabold tracking-[0.1em] uppercase " +
              (chain === "kept"
                ? "border-accent bg-accent-soft text-accent"
                : "border-line-strong text-muted")
            }
          >
            {chain === "kept" ? "kalan" : "yeni"}
          </span>
        )}
      </span>

      <span className="text-sm text-muted">{player.clubs.join(" · ")}</span>

      {/*
        DEĞER PLAKASININ YÜKSEKLİĞİ SABİT. Kapalı ve açık hâl aynı yeri
        kaplıyor; kart açılırken büyüseydi, sayfa cevabın tam okunacağı anda
        kayardı. Sabit yükseklik açılışı bir YENİDEN YERLEŞİM değil, bir
        ÇEVİRME hâline getiriyor.
      */}
      <span className="flex h-16 w-full flex-col justify-center">
        {value === null ? (
          /*
            Tire "burada bir şey yok" der; kapalı plaka "burada kapalı bir şey
            var" der (BR-32). Ekran okuyucuya giden ad değişmedi.
          */
          <span
            aria-label="değer gizli"
            className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-line-strong bg-surface-2 text-3xl font-black text-muted"
          >
            ?
          </span>
        ) : (
          <span
            className="animate-duel-reveal flex flex-col gap-2"
            style={{ animationDelay: `${String(revealDelayMs)}ms` }}
          >
            <span className="text-4xl leading-none font-black tabular-nums">
              {String(value)}{" "}
              <span className="text-sm font-bold tracking-wide text-muted uppercase">
                {unit}
              </span>
            </span>

            {/*
              KARŞILAŞTIRMA ÇUBUĞU. Açılan sayının cevaplamadığı soruyu
              cevaplıyor: "yakın mıydı?". `aria-hidden`, çünkü sayı hemen
              üstünde yazılı — çubuk onun ikinci kez söylenmesi.
            */}
            <span
              aria-hidden="true"
              className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <span
                className={
                  "animate-duel-bar block h-full origin-left rounded-full " +
                  BAR_CLASS[outcome]
                }
                style={{
                  transform: `scaleX(${String(share)})`,
                  animationDelay: `${String(revealDelayMs + 80)}ms`,
                }}
              />
            </span>
          </span>
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

/**
 * Serinin ÖLÇÜLMÜŞ bandı — §9.3'ün BR-30 tablosundan.
 *
 * Dengeli rakiple bilgisiz oynayan bir koşunun p90'ı 3, p99'u 6 ölçüldü. Yani
 * 4. doğru "on koşuda bir", 7. doğru "yüz koşuda bir" görülen yerdir. Eşikler
 * bir tasarım hevesi değil, şartnamenin kendi ölçümü; ölçüm değişirse bu iki
 * sayı da değişmek zorunda. Uydurulmuş bir "5 seri = süper!" eşiği, ölçüm
 * kültürü olan bir üründe yalan söylerdi.
 */
function streakBand(streak: number): string | null {
  if (streak >= 7) return "Rastgele oynayan yüz koşuda bir kez buraya gelir.";
  if (streak >= 4) return "Rastgele oynayan on koşuda bir kez buraya gelir.";
  return null;
}

/**
 * Doğru cevabın sonuç şeridi.
 *
 * NEDEN ŞERİT. Önceki hâl `text-correct` bir "Doğru!" sözcüğüydü — ekrandaki
 * en küçük yazılardan biri, tam da en büyük olması gereken anda. İşaret renge
 * EK bir göstergedir (WCAG 1.4.1): rengi ayırt edemeyen kullanıcı `✓` görür,
 * ekran okuyucu kullanıcısı canlı bölgeden "Doğru!" duyar.
 */
function VerdictBar({
  streak,
  onContinue,
}: {
  readonly streak: number;
  onContinue(): void;
}) {
  const band = streakBand(streak);

  return (
    <div className="animate-duel-verdict flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border-2 border-correct bg-correct-soft px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-correct text-xl font-black text-background"
      >
        ✓
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <p className="text-lg font-extrabold text-correct">Doğru!</p>
        {band !== null && <p className="text-sm text-muted">{band}</p>}
      </div>

      <button
        type="button"
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={onContinue}
      >
        Devam
      </button>
    </div>
  );
}

interface OverPanelProps {
  readonly title: string;
  readonly detail: string;
  readonly streak: number;
  /**
   * Koşunun NASIL bittiği. Yanlış cevap bir hatadır ve öyle görünür; havuzun
   * tükenmesi bir hata değil, kaynağın sınırıdır (§6.6) — kırmızıya boyamak
   * kullanıcıya yanlış yaptığını söylerdi.
   */
  readonly tone: "wrong" | "note";
  onRestart(): void;
}

function OverPanel({ title, detail, streak, tone, onRestart }: OverPanelProps) {
  const band = streakBand(streak);

  return (
    <div
      className={
        "animate-duel-verdict flex flex-col gap-3 rounded-xl border-2 px-4 py-4 " +
        (tone === "wrong"
          ? "border-wrong bg-wrong-soft"
          : "border-line bg-surface")
      }
    >
      <div className="flex items-center gap-3">
        {tone === "wrong" && (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wrong text-xl font-black text-background"
          >
            ✗
          </span>
        )}
        <p className="text-lg font-extrabold">{title}</p>
      </div>

      <p className="text-muted">{detail}</p>
      <p>
        Skorun:{" "}
        <span className="text-3xl font-black tabular-nums">{streak}</span> doğru
      </p>
      {band !== null && <p className="text-sm text-muted">{band}</p>}

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
              /*
                SEÇİLİ OLAN YALNIZCA RENKLE AYRILMIYOR (WCAG 1.4.1): yazı
                kalınlığı da değişiyor. Kenarlık iki durumda da `border-2`,
                yoksa seçim ızgarayı bir piksel oynatırdı.
              */
              <label
                key={key}
                className={`cursor-pointer rounded-xl border-2 px-3 py-3 text-sm transition-[transform,box-shadow,background-color,border-color] duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                  isCurrent
                    ? "border-accent bg-accent-soft font-bold text-accent shadow-card"
                    : "border-line-strong bg-surface font-medium hover:-translate-y-0.5 hover:border-accent hover:shadow-card"
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
              className={`cursor-pointer rounded-lg border-2 px-3 py-1.5 text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                isCurrent
                  ? "border-accent bg-accent-soft font-bold text-accent"
                  : "border-line-strong bg-surface font-medium hover:border-accent"
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

      {/*
        Kurulum ekranının TEK eylemi bu; ölçüsü de onu söylüyor. Diğer
        modlardaki "Devam" düğmesiyle aynı puntoda durması, koşuyu başlatan
        kararı sıradan bir ilerleme adımı gibi gösteriyordu.
      */}
      <div>
        <button
          type="button"
          className="rounded-xl bg-accent px-7 py-3 text-base font-bold text-accent-fg shadow-card transition-[transform,box-shadow,opacity] duration-150 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-0"
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
