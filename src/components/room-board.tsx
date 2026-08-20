"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RoomDto } from "@/application/use-cases/rooms";
import { STAT_KEYS, type StatKey } from "@/domain/services/stat-match";
import {
  readClock,
  readClockOnServer,
  subscribeToClock,
} from "@/lib/coarse-clock";
import { pollDelay, pollPhase, pollSignature } from "@/lib/room-polling";
import { readErrorMessage } from "@/lib/http/error-message";
import { searchPlayersForStat } from "@/lib/http/player-search";
import type { StatMatchState } from "@/lib/stat-match-storage";
import { ModeHeader, Scoreboard } from "./mode-header";
import { RoomResult, sidePoints } from "./room-result";
import { StatMatchGame } from "./stat-match-game";
import { useCreateRoom } from "./use-create-room";

/**
 * Oda ekranı — PROJECT.md §12.1, §12.4.
 *
 * GERÇEK ZAMAN YOK, YOKLAMA VAR. İstatistik modu sıra tabanlı değil: iki
 * oyuncu aynı hedefe karşı birbirinden bağımsız oynuyor. Canlı paylaşılan tek
 * olgu "rakibim bitirdi mi" ve bir soruluk bu bilgi için WebSocket kurmak
 * Hobby planında zaten mümkün değildi (§12.1). Yoklama bu tek soruyu
 * yanıtlıyor ve §7.4'ün sabit adres listesi iki adres olarak kalıyor.
 */

/** İki üst üste başarısız yoklamadan önce hiçbir şey söylenmiyor. */
const FAILURES_BEFORE_WARNING = 2;

export interface RoomBoardProps {
  /**
   * Sunucu sayfasında okunan ilk hâl.
   *
   * NEDEN SUNUCUDAN. İstemciye bırakılsaydı ekran önce boş çizilir, sonra oda
   * "atlayarak" gelirdi — `/istatistik` sayfasında saklanan tur için verilen
   * kararın aynısı (§11). Odada bedeli daha da yüksek olurdu: kullanıcı bir
   * an için kodunu göremezdi.
   */
  readonly initialRoom: RoomDto;
}

export function RoomBoard({ initialRoom }: RoomBoardProps) {
  const [room, setRoom] = useState(initialRoom);
  const [failures, setFailures] = useState(0);

  const code = room.code;
  const phase = pollPhase(room);

  /**
   * Yoklama döngüsü odanın güncel hâlini KENDİ içinde saklıyor; ref yalnızca
   * döngü kurulurken başlangıç imzasını okumak için var. `room`'u doğrudan
   * bağımlılığa koymak döngüyü her yanıtta baştan kurardı ve büyüme sayacı
   * hiçbir zaman ilerlemezdi.
   */
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (phase === null) return;

    let stopped = false;
    let quiet = 0;
    let last = pollSignature(roomRef.current);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wake: (() => void) | null = null;
    const controller = new AbortController();

    const sleep = (ms: number): Promise<void> =>
      new Promise<void>((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, ms);
      });

    /**
     * GÖRÜNMEYEN SEKME YOKLAMAZ. Arka planda açık kalmış bir oda, hiç kimsenin
     * bakmadığı bir ekran için dakikalarca istek üretirdi — üstelik tarayıcılar
     * arka plan zamanlayıcılarını zaten kısıyor, yani istekler düzensiz
     * kümeler hâlinde giderdi.
     *
     * SEKMEYE DÖNÜNCE HEMEN YOKLANIR: kullanıcı geri geldiğinde ekranın eski
     * olduğunu görmemeli. Bekleyen uyku iptal ediliyor ve sayaç sıfırlanıyor.
     */
    const onVisibility = (): void => {
      if (document.visibilityState !== "visible") return;
      quiet = 0;
      if (timer !== undefined) clearTimeout(timer);
      wake?.();
    };

    document.addEventListener("visibilitychange", onVisibility);

    const loop = async (): Promise<void> => {
      while (!stopped) {
        await sleep(pollDelay(phase, quiet));
        if (stopped) return;

        if (document.visibilityState === "hidden") {
          quiet = 0;
          continue;
        }

        try {
          const response = await fetch(`/api/oda/${encodeURIComponent(code)}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await readErrorMessage(response));

          const body = (await response.json()) as { data: RoomDto };
          if (stopped) return;

          const next = pollSignature(body.data);
          quiet = next === last ? quiet + 1 : 0;
          last = next;

          setFailures(0);
          setRoom(body.data);
        } catch {
          if (stopped) return;

          /**
           * BAŞARISIZ YOKLAMA DÖNGÜYÜ DURDURMAZ. Ağ birkaç saniye gidip
           * gelebilir; ekranı bir hatayla kapatmak, oda hâlâ oynanabilirken
           * oyunu bitirmek olurdu. Sayaç yine de ilerliyor: sunucu gerçekten
           * yoksa saniyede bir denemenin anlamı yok.
           */
          quiet += 1;
          setFailures((count) => count + 1);
        }
      }
    };

    void loop();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
      wake?.();
    };
  }, [code, phase]);

  /**
   * Cevap gönderimi — yanıt odanın TAMAMINI geri getiriyor.
   *
   * Bu yüzden `oynuyorum` düzeninde yoklama seyrek olabiliyor: kullanıcı
   * oynadıkça ekran zaten tazeleniyor. Hedefin kimliği GÖNDERİLMİYOR (BR-56);
   * hedef odanın satırında yazılı.
   */
  const submit = useCallback(
    async (
      statKey: StatKey,
      playerId: string,
    ): Promise<{ value: number; score: number }> => {
      const response = await fetch(
        `/api/oda/${encodeURIComponent(code)}/cevap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statKey, playerId }),
        },
      );
      // Sunucunun gerekçesi OLDUĞU GİBİ yukarı taşınır (§6.3).
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as {
        data: { value: number; score: number; room: RoomDto };
      };

      setRoom(body.data.room);
      return { value: body.data.value, score: body.data.score };
    },
    [code],
  );

  const warn = failures >= FAILURES_BEFORE_WARNING;

  if (room.status === "bekliyor") {
    return <RoomLobbyView room={room} offline={warn} />;
  }

  if (room.status === "suresi-doldu") return <RoomExpiredView room={room} />;

  return <RoomPlayView room={room} offline={warn} submitAnswer={submit} />;
}

/* ------------------------------------------------------------------ */
/* Bekleme                                                             */
/* ------------------------------------------------------------------ */

function RoomLobbyView({
  room,
  offline,
}: {
  readonly room: RoomDto;
  readonly offline: boolean;
}) {
  const remaining = useRemainingMinutes(room.expiresAt);

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        eyebrow="ODA"
        title="Arkadaşını bekliyorsun"
        task={
          <>
            Aşağıdaki kodu arkadaşına gönder. O odaya katıldığı an{" "}
            <strong className="font-semibold text-foreground">
              ikinize aynı futbolcu
            </strong>{" "}
            açılır ve tur ikiniz için birden başlar.
          </>
        }
        scoreboard={
          <Scoreboard
            label="Oda durumu"
            cells={[
              {
                label: "Kalan süre",
                value: remaining === null ? "—" : `${String(remaining)} dk`,
                small: true,
              },
            ]}
          />
        }
      />

      <RoomCodeCard code={room.code} />

      {/*
        BR-57 BURADA GÖRÜNÜR HÂLE GETİRİLİYOR. Kurucu, futbolcuyu neden
        göremediğini bilmezse bunu bir arıza sanır. Kuralın kendisi de bir
        vaat: kimse ötekinden önce görmüyor.
      */}
      <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
        Futbolcu{" "}
        <strong className="text-foreground">şimdi gösterilmiyor</strong>. Odayı
        kuran kişinin erken hazırlanmaması için hedef, ikinci oyuncu katıldığı
        anda ikinize birden açılıyor.
      </p>

      <ConnectionNote offline={offline} />

      <p className="text-sm text-muted">
        Otuz dakika içinde kimse katılmazsa oda kendiliğinden kapanır.{" "}
        <Link
          href="/istatistik"
          className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Beklerken günün turunu oyna
        </Link>
        .
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Oynanıyor ve bitti                                                  */
/* ------------------------------------------------------------------ */

const OUTCOME_TITLE: Readonly<Record<RoomDto["outcome"], string>> = {
  devam: "Arkadaş Maçı",
  yarim: "Tur yarım kaldı",
  beraberlik: "Berabere",
  kazandin: "Kazandın",
  kaybettin: "Kaybettin",
};

function RoomPlayView({
  room,
  offline,
  submitAnswer,
}: {
  readonly room: RoomDto;
  readonly offline: boolean;
  submitAnswer(
    statKey: StatKey,
    playerId: string,
  ): Promise<{ value: number; score: number }>;
}) {
  const target = room.target;
  const opponent = room.opponent;
  const finished = room.status === "bitti";
  const remaining = useRemainingMinutes(room.expiresAt);

  /**
   * `oynaniyor` ve `bitti` durumları hedefi ve rakibi GARANTİ EDER (§12.3);
   * bu dal yalnızca tipi daraltıyor. Yine de sessiz bir boş ekran yerine
   * anlaşılır bir cümle bırakıyor.
   */
  if (target === null || opponent === null) {
    return (
      <p role="alert" className="text-sm text-muted">
        Bu oda okunamadı. Sayfayı yenileyin.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <ModeHeader
          eyebrow={`ODA · ${room.code}`}
          title={OUTCOME_TITLE[room.outcome]}
          task={
            finished ? (
              <>
                İkiniz de bitirdiniz. Aşağıda aynı hedefe kimi yazdığınız yan
                yana duruyor.
              </>
            ) : (
              <>
                Aynı futbolcuya karşı{" "}
                <strong className="font-semibold text-foreground">
                  {opponent.displayName}
                </strong>{" "}
                ile yarışıyorsun. Rakibinin puanı, ikiniz de bitirene kadar
                gizli.
              </>
            )
          }
          scoreboard={
            <Scoreboard
              label="Maç durumu"
              lit={finished}
              cells={
                finished
                  ? [
                      {
                        label: "Sen",
                        value: sidePoints(room.me),
                        tone:
                          room.outcome === "kazandin" ? "correct" : "accent",
                      },
                      {
                        label: opponent.displayName,
                        value: sidePoints(opponent),
                        tone:
                          room.outcome === "kaybettin" ? "correct" : undefined,
                      },
                    ]
                  : [
                      {
                        label: "Sen",
                        value: `${String(room.me.answered)}/${String(STAT_KEYS.length)}`,
                        tone: room.me.answered > 0 ? "accent" : undefined,
                      },
                      {
                        label: opponent.displayName,
                        value: `${String(opponent.answered)}/${String(STAT_KEYS.length)}`,
                      },
                      {
                        label: "Kalan",
                        value:
                          remaining === null ? "—" : `${String(remaining)} dk`,
                        small: true,
                      },
                    ]
              }
            />
          }
        />
      </div>

      {finished ? (
        <>
          <RoomResult room={room} />
          <Rematch />
        </>
      ) : (
        <>
          {/*
            BR-63 — RAKİBİN YALNIZCA SAYACI GÖRÜNÜR. Puanı da gösterilseydi
            oyuncu "bu değere en yakın kimi biliyorum" sorusunu bırakıp "kaç
            puan lazım" hesabına geçerdi; oyunun sorusu sessizce değişirdi.
          */}
          <p
            aria-live="polite"
            className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted"
          >
            <strong className="text-foreground">{opponent.displayName}</strong>{" "}
            {opponent.answered === STAT_KEYS.length
              ? "turunu bitirdi ve seni bekliyor."
              : `${String(opponent.answered)}/${String(STAT_KEYS.length)} istatistik cevapladı.`}{" "}
            Puanlar ikiniz de bitirince açılır.
          </p>

          <ConnectionNote offline={offline} />

          <StatMatchGame
            round={target}
            /*
              KENDİ CEVAPLARIM SUNUCUDAN GELİYOR — `localStorage` YOK. Oda
              turu tarayıcıya yazılamaz: aynı tur iki kişide ayrı ayrı
              yaşıyor ve tek otorite sunucu. Sayfa yenilendiğinde tahtanın
              kapalı istatistikleri buradan çiziliyor.
            */
            serverAnswers={toGameAnswers(room)}
            submitAnswer={submitAnswer}
            searchPlayers={searchPlayersForStat}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Süresi doldu                                                        */
/* ------------------------------------------------------------------ */

function RoomExpiredView({ room }: { readonly room: RoomDto }) {
  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        eyebrow={`ODA · ${room.code}`}
        title="Süre doldu"
        task="Bu odanın süresi doldu. Yarım kalan turun galibi yoktur."
      />

      {/*
        BR-61 AÇIKÇA YAZILI. "Ben bitirmiştim, o bitirmedi, o hâlde ben
        kazandım" beklentisi doğaldır ve karşılanmayacaksa sebebiyle birlikte
        söylenmeli: hükmen galibiyet, rakibi bağlantısını kesmeye teşvik
        ederdi.
      */}
      <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
        Turu ikiniz de bitirmediğiniz için sonuç sayılmadı — bitiren tarafı
        hükmen galip saymıyoruz.
      </p>

      <Rematch />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ortak parçalar                                                      */
/* ------------------------------------------------------------------ */

function Rematch() {
  const { create, isCreating, failure } = useCreateRoom();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={isCreating}
        className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
        onClick={create}
      >
        {isCreating ? "Oda kuruluyor…" : "Yeni oda kur"}
      </button>

      <Link
        href="/istatistik"
        className="rounded-lg border border-line px-4 py-3 text-sm font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Günün turuna dön
      </Link>

      {failure !== null && (
        <p
          role="alert"
          className="basis-full rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
        >
          {failure}
        </p>
      )}
    </div>
  );
}

function ConnectionNote({ offline }: { readonly offline: boolean }) {
  if (!offline) return null;

  return (
    <p
      role="status"
      className="rounded-xl border border-warn bg-warn-soft px-4 py-3 text-sm text-warn"
    >
      Odanın durumu güncellenemiyor. Bağlantı geri geldiğinde ekran
      kendiliğinden tazelenecek.
    </p>
  );
}

/**
 * Kod kartı — odanın paylaşılan sırrı.
 *
 * KOD `font-mono` VE ARALIKLI. Telefonda okunup karşı tarafa sesli
 * söylenecek; harfler bitişik ve orantılı bir yazıyla dizildiğinde
 * `RN`/`M` gibi ikililer karışıyor. Alfabede zaten karışan işaretler yok
 * (`0/O`, `1/I/L` elendi, BR-55) ama tipografi de yardım etmeli.
 */
function RoomCodeCard({ code }: { readonly code: string }) {
  const [copied, setCopied] = useState<"kod" | "bag" | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = useCallback((what: "kod" | "bag", text: string): void => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopyFailed(false);
        setCopied(what);
      } catch {
        // Pano izni verilmemiş ya da güvenli bağlam değil. Kod ekranda zaten
        // seçilebilir duruyor; tek yapılacak bunu söylemek.
        setCopyFailed(true);
      }
    })();
  }, []);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-accent bg-accent-soft p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <p className="text-[0.65rem] font-extrabold tracking-[0.13em] text-muted uppercase">
          Oda kodu
        </p>
        <p className="font-mono text-4xl font-bold tracking-[0.2em] text-accent sm:text-5xl">
          {code}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => {
            copy("kod", code);
          }}
        >
          Kodu kopyala
        </button>

        <button
          type="button"
          className="rounded-lg border border-accent px-4 py-3 text-sm font-semibold text-accent hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => {
            /*
              ADRES OLAY ANINDA OKUNUYOR, DURUMDA TUTULMUYOR. Durumda
              tutulsaydı `window`'u okumak için bir efekt gerekirdi ve efekt
              içinde `setState` basamaklı render üretirdi (§7.13). Tıklama
              zaten tarayıcıda geçiyor; sayfanın adresi tam olarak odanın
              adresi.
            */
            copy("bag", window.location.href);
          }}
        >
          Bağlantıyı kopyala
        </button>
      </div>

      {/* Kopyalama geri bildirimi SESSİZ OLAMAZ: pano görünmez bir yerdir ve
          işe yarayıp yaramadığı yalnızca söylenerek anlaşılır. */}
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {copyFailed
          ? "Kopyalanamadı — kodu elle seçebilirsin."
          : copied === "kod"
            ? "Kod kopyalandı."
            : copied === "bag"
              ? "Bağlantı kopyalandı."
              : ""}
      </p>
    </section>
  );
}

/**
 * Kalan süre — DAKİKA cinsinden, saniye değil.
 *
 * Saniye göstermek her saniye yeniden çizim demekti ve hiçbir karara
 * yaramazdı: eşikler otuz ve altmış dakika (BR-60).
 *
 * SAAT BİR DIŞ SİSTEM (`coarse-clock.ts`): sunucuda `null` okunuyor, çünkü
 * sunucunun saatiyle kullanıcının saati aynı değil ve ilk çizimde hesaplanan
 * değer hidrasyonda uyuşmazlık üretirdi. Ekranda önce bir tire duruyor.
 */
function useRemainingMinutes(expiresAt: string): number | null {
  const now = useSyncExternalStore(
    subscribeToClock,
    readClock,
    readClockOnServer,
  );

  if (now === null) return null;

  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
}

/** Oda cevaplarını oyun bileşeninin beklediği biçime çevirir. */
function toGameAnswers(room: RoomDto): StatMatchState["answers"] {
  return Object.fromEntries(
    (room.me.answers ?? []).map((answer) => [
      answer.statKey,
      {
        playerId: answer.playerId,
        playerName: answer.playerName,
        value: answer.value,
        score: answer.score,
      },
    ]),
  );
}
