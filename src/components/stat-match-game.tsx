"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type {
  StatDto,
  StatMatchRoundDto,
} from "@/application/use-cases/daily-stat-match";
import {
  isRoundComplete,
  SCORE_TOLERANCE_FACTOR,
  STAT_DEVIATIONS,
  STAT_KEYS,
  totalScore,
  type StatKey,
} from "@/domain/services/stat-match";
import { PUZZLE_ROLLOVER_HOUR } from "@/domain/value-objects/daily-seed";
import { countryName } from "@/lib/country-name";
import {
  parseStatMatch,
  readStatMatch,
  readStatMatchOnServer,
  subscribeToStatMatch,
  writeStatMatch,
  type StatMatchState,
} from "@/lib/stat-match-storage";
import { ModeHeader, Scoreboard } from "./mode-header";
import { PlayerPicker } from "./player-picker";

/**
 * İstatistik eşleştirme oyunu — PROJECT.md §9.2.
 *
 * BU BİLEŞEN PUAN HESAPLAMAZ. Puanı sunucu verir (BR-20); burada yalnızca
 * gösterilir ve saklanır. Formülü istemcide tekrarlamak, iki yerde ayrı ayrı
 * yazılmış bir kural demekti ve er geç ayrışırdı.
 *
 * BR-17 (bir oyuncu bir kez) yalnızca istemcide zorlanıyor — ızgaradaki
 * BR-10 ile aynı sınır ve aynı gerekçe (§9.1).
 */

/**
 * Günlük turun kaydedilme durumu — PROJECT.md §11.11.
 *
 * VERİLMEZSE HİÇBİR ŞEY YAZILMAZ ve bu üç ayrı durumu kapsıyor: "Sen seç"
 * turu (zaten kaydedilmez, BR-24), hesap özelliğinin kapalı olduğu kurulum
 * (olmayan bir özelliği tanıtmak yanıltıcı olurdu) ve bileşeni doğrudan
 * kullanan testler.
 */
export type RoundRecording =
  | { readonly kind: "misafir" }
  | { readonly kind: "kayitli"; readonly displayName: string };

/**
 * Yeni bulmacanın yayın saati — BR-49'un sabitinden TÜRETİLİR.
 *
 * Metne elle yazılmıştı ve sınır 06:00'ya taşındığında geride kaldı: ekran
 * aylarca "03.00" dedi (§11.11). Sabitten türetmek ikinci kez ayrışmayı
 * imkânsız kılıyor.
 */
const ROLLOVER_LABEL = `${String(PUZZLE_ROLLOVER_HOUR).padStart(2, "0")}.00`;

export interface StatMatchGameProps {
  /** Turun hedefi ve altı istatistiği — günlük ya da kullanıcı seçimi. */
  readonly round: StatMatchRoundDto;
  /**
   * Varsa ilerleme o güne yazılır (BR-19); yoksa tur SAKLANMAZ.
   *
   * "Sen seç" turları saklanmaz ve bu bilinçli (§9.2): günlük ilerleme gün
   * anahtarına yazılır çünkü "bugünün turu" tekildir, oysa kullanıcı istediği
   * kadar tur açabilir. Hepsini saklamak depoyu sınırsız büyütür ve "hangi
   * tur devam ediyor" sorusunu doğururdu.
   */
  readonly date?: string;
  /**
   * Verilirse sayfanın mod künyesi buradan basılır ve sayaçlar tabelaya
   * taşınır (§7.15). "Sen seç" turu vermez: ikinci bir `h1` olamaz.
   */
  readonly header?: { readonly eyebrow?: string; readonly title: string };
  /** Tur bitince yeni hedef seçmek için — yalnızca "Sen seç" turunda. */
  onRestart?: () => void;
  /**
   * Hedef kartı ile istatistik satırları arasına giren şerit.
   *
   * ADI KONUMU SÖYLÜYOR, İÇERİĞİNİ DEĞİL ve bu kasıtlı: oyun bileşeni odayı
   * — ya da buraya bir gün konacak başka bir şeyi — tanımak zorunda değil.
   * `recording` gibi anlamlı bir prop eklemek, `StatMatchGame`'i her yeni
   * duyuru için yeniden düzenlemek demekti.
   *
   * NEDEN TAM BURASI. Bu nokta kullanıcının "bu oyun ne, bugünün oyuncusu
   * kim" sorularını yanıtlamış ama HENÜZ OYNAMAYA BAŞLAMAMIŞ olduğu an.
   * Künyenin üstüne konsaydı henüz neyin alternatifi olduğu bilinmezdi;
   * altı istatistik satırının ARDINA konduğunda ise — ki ilk hâli öyleydi —
   * sayı doğrularıyla birlikte yaklaşık 1.200 piksel aşağıda kalıp pratikte
   * hiç görülmüyordu.
   */
  readonly beforeStats?: ReactNode;
  /**
   * SUNUCUDA SAKLANAN tur — yalnızca giriş yapmış kullanıcının günlük turunda
   * verilir (§11, BR-43).
   *
   * VERİLDİĞİNDE TEK GERÇEK KAYNAK ODUR: `localStorage` okunmaz ve yazılmaz.
   * İkisini birden kullanmak, sunucunun "bu istatistik cevaplandı" dediği bir
   * turu ekranda boş göstermek demekti — kullanıcı yeniden dener ve reddedilir.
   */
  readonly serverAnswers?: StatMatchState["answers"];
  /**
   * Turun kaydedilip kaydedilmediği — §11.11'in "durum her zaman yazılıdır"
   * kuralı. Oturum bilgisi istemciye ait olmadığı için SUNUCU SAYFASINDAN
   * gelir; burada okunmaya çalışılsaydı sayfa önce yanlış durumu çizerdi.
   */
  readonly recording?: RoundRecording;
  /** Cevap gönderimi; testlerde sahte bir uygulama verilir. */
  submitAnswer(
    statKey: StatKey,
    playerId: string,
  ): Promise<{ value: number; score: number }>;
  /**
   * `statKey` ile çağrılır: BR-16 gereği arama, o istatistikte puanlanabilir
   * oyuncularla sınırlanmalı (§9.2).
   */
  searchPlayers(
    term: string,
    signal: AbortSignal,
    statKey: StatKey,
  ): Promise<PlayerDto[]>;
}

function emptyRound(date: string): StatMatchState {
  return { date, answers: {} };
}

/**
 * Ad → baş harfler. "Éric Cantona" → "EC".
 *
 * Türkçe yerel ayarla büyütülüyor: `toUpperCase()` "ı" harfini "I" değil
 * "I" yapar ama "i" harfini "I" yapar ve Türkçede doğrusu "İ"dir. Adlar
 * çoğunlukla yabancı olsa da yanlışın maliyeti sıfırken doğrusunu yazmamak
 * için sebep yok.
 */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/u).filter((part) => part.length > 0);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("tr");
}

/**
 * Puan bandına göre rozet rengi.
 *
 * Eşikler KEYFİ DEĞİL, §9.2'deki puanlama eğrisinden: %80 ve üzeri "isabet",
 * %50–79 "yakın", altı "uzak". Renk yalnızca destekleyicidir — yüzde değeri
 * rozetin metninde zaten yazılı (WCAG 1.4.1).
 */
function scoreTone(score: number): string {
  if (score >= 80) return "bg-correct-soft text-correct";
  if (score >= 50) return "bg-warn-soft text-warn";
  return "bg-wrong-soft text-wrong";
}

export function StatMatchGame({
  header,
  round,
  date,
  onRestart,
  beforeStats,
  serverAnswers,
  recording,
  submitAnswer,
  searchPlayers,
}: StatMatchGameProps) {
  const raw = useSyncExternalStore(
    subscribeToStatMatch,
    readStatMatch,
    readStatMatchOnServer,
  );

  /**
   * Saklanmayan turun cevapları. İki kaynak da HER RENDER'DA okunur (kancalar
   * koşullu çağrılamaz); hangisinin geçerli olduğuna `date` karar verir.
   */
  const [localAnswers, setLocalAnswers] = useState<StatMatchState["answers"]>(
    {},
  );

  /**
   * Sunucu turunun ekrandaki kopyası. İlk değeri sunucudan gelir; her
   * cevaptan sonra sunucunun yanıtıyla güncellenir.
   *
   * SUNUCU HÂLÂ TEK OTORİTE: buradaki kopya yalnızca çizim içindir ve bir
   * sonraki sayfa yüklemesinde yine sunucudan gelir.
   */
  const [serverState, setServerState] = useState<StatMatchState["answers"]>(
    serverAnswers ?? {},
  );

  const usesServer = serverAnswers !== undefined;

  const state = useMemo(() => {
    if (usesServer) return { date: date ?? "", answers: serverState };

    return date === undefined
      ? { date: "", answers: localAnswers }
      : (parseStatMatch(raw, date) ?? emptyRound(date));
  }, [raw, date, localAnswers, serverState, usesServer]);

  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const answers = Object.entries(state.answers) as [
    StatKey,
    NonNullable<StatMatchState["answers"][StatKey]>,
  ][];
  const finished = isRoundComplete(answers.length);
  const total = totalScore(answers.map(([, answer]) => answer.score));

  // BR-17 — kullanılmış oyuncular ve hedefin kendisi seçilemez.
  const usedPlayerIds = new Set([
    round.player.id,
    ...answers.map(([, answer]) => answer.playerId),
  ]);

  const submit = useCallback(
    async (statKey: StatKey, player: PlayerDto): Promise<void> => {
      setOpenStat(null);
      setIsChecking(true);
      setFailure(null);

      try {
        const result = await submitAnswer(statKey, player.id);
        const entry = {
          playerId: player.id,
          playerName: player.name,
          value: result.value,
          score: result.score,
        };

        // Giriş yapılmışsa tur SUNUCUDA duruyor; tarayıcıya kopya yazmak
        // iki gerçek kaynak yaratırdı.
        if (usesServer) {
          setServerState((current) => ({ ...current, [statKey]: entry }));
          return;
        }

        if (date === undefined) {
          // Saklanmayan tur: aynı yarış koşulu burada da var, bu yüzden
          // güncelleyici biçim kullanılıyor.
          setLocalAnswers((current) => ({ ...current, [statKey]: entry }));
          return;
        }

        // Güncel durum YAZMA ANINDA okunur; bekleyen isteğin başladığı andaki
        // kopyanın üzerine yazmak, arada tamamlanan bir cevabı silerdi.
        const current =
          parseStatMatch(readStatMatch(), date) ?? emptyRound(date);

        writeStatMatch({
          date: current.date,
          answers: { ...current.answers, [statKey]: entry },
        });
      } catch (error: unknown) {
        // Sunucu "bu oyuncunun verisi yok" diyorsa (BR-16) bunu OLDUĞU GİBİ
        // göster: kullanıcı neden reddedildiğini bilmeli, yoksa aynı hatayı
        // tekrarlar.
        setFailure(
          error instanceof Error && error.message.length > 0
            ? error.message
            : "Cevap gönderilemedi. Lütfen tekrar deneyin.",
        );
      } finally {
        setIsChecking(false);
      }
    },
    [submitAnswer, date, usesServer],
  );

  const openStatDto =
    openStat === null
      ? undefined
      : round.stats.find((stat) => stat.key === openStat);

  // `PlayerPicker` iki argümanlı bir arama bekler; açık istatistiği buraya
  // kapatarak taşıyoruz. `useMemo` olmadan her render yeni bir fonksiyon
  // üretir ve seçicinin arama efekti sürekli yeniden çalışırdı.
  const searchForOpenStat = useMemo(
    () =>
      openStat === null
        ? null
        : (term: string, signal: AbortSignal) =>
            searchPlayers(term, signal, openStat),
    [openStat, searchPlayers],
  );

  return (
    <div className="flex flex-col gap-6">
      {/*
        KÜNYE VE TABELA (§7.15). Sayaçlar bu bileşenin durumundan geliyor;
        künyeyi sunucu sayfasında bırakmak aynı sayının iki yerde yaşaması
        demekti. "Sen seç" turu `header` ALMAZ — sayfada ikinci bir `h1`
        olamaz — ve kendi satır içi sayacını korur.

        Ortalama yüzde BR-18'in puan bandına göre renkleniyor: 80 ve üstü
        `correct`, 50–79 `warn`, altı renksiz. Renk tek gösterge değil, sayı
        zaten yazılı (WCAG 1.4.1).
      */}
      {header !== undefined && (
        <div aria-live="polite">
          <ModeHeader
            eyebrow={header.eyebrow}
            title={header.title}
            task={
              <>
                Altı istatistiğin her biri için, değeri günün oyuncusuna{" "}
                <strong className="font-semibold text-foreground">
                  en yakın
                </strong>{" "}
                olan{" "}
                <strong className="font-semibold text-foreground">başka</strong>{" "}
                bir futbolcu bul.
              </>
            }
            scoreboard={
              <Scoreboard
                label="Tur durumu"
                lit={finished}
                cells={[
                  {
                    label: "Cevaplanan",
                    value: `${String(answers.length)}/${String(STAT_KEYS.length)}`,
                    tone: answers.length > 0 ? "accent" : undefined,
                  },
                  {
                    label: "Ortalama",
                    value: answers.length === 0 ? "—" : `%${String(total)}`,
                    tone:
                      answers.length === 0
                        ? undefined
                        : total >= 80
                          ? "correct"
                          : total >= 50
                            ? "warn"
                            : undefined,
                  },
                ]}
              />
            }
          />
        </div>
      )}

      <section className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
        {/* Baş harfler: günün oyuncusu ekranın ÖZNESİ ama tek satır metin
            olarak duruyordu. Fotoğraf yok (veri kümesi taşımıyor); baş harf
            en azından bir çapa veriyor. Süsleme olduğu için `aria-hidden`. */}
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent"
        >
          {initialsOf(round.player.name)}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">
            {round.player.name}
            {round.player.nationality !== null && (
              <span className="ml-2 text-sm font-normal text-muted">
                {countryName(round.player.nationality)}
              </span>
            )}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Her istatistik için, değeri buna{" "}
            <strong className="font-semibold text-foreground">en yakın</strong>{" "}
            olduğunu düşündüğünüz{" "}
            <strong className="font-semibold text-foreground">farklı</strong>{" "}
            bir futbolcu seçin.
          </p>
        </div>
      </section>

      {/*
        KAYIT ŞERİDİ (§11.11). Lider tablosu çalışıyordu ama oyun ekranı ondan
        hiç söz etmiyordu; kullanıcı giriş yapmadan oynuyor ve turunun hiçbir
        yere yazılmadığını ÖĞRENEBİLECEĞİ bir yer bulunmuyordu.

        DAVET TURUN BAŞINDA. Biten bir misafir turu giriş yapılınca sunucuya
        taşınmaz; sonunda davet etmek kaçırılanı haber vermek olurdu.

        GİRİŞ DUVARI DEĞİL: bildirim, engel değil (§11.1).
      */}
      {recording !== undefined && (
        <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
          {recording.kind === "misafir" ? (
            <>
              Bu tur <strong className="text-foreground">kaydedilmiyor</strong>.{" "}
              <Link
                href="/giris"
                className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Giriş yap
              </Link>{" "}
              — tamamladığın günlük turlar lider tablosuna girer.
            </>
          ) : (
            <>
              <strong className="text-foreground">
                {recording.displayName}
              </strong>{" "}
              adıyla oynuyorsun. Turu tamamlayınca{" "}
              <Link
                href="/lider-tablosu"
                className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                lider tablosuna
              </Link>{" "}
              girersin.
            </>
          )}
        </p>
      )}

      {header === undefined && (
        <p
          className="w-fit rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold tabular-nums shadow-card"
          aria-live="polite"
        >
          {String(answers.length)}/{String(STAT_KEYS.length)} cevaplandı
          {answers.length > 0 && ` · ortalama %${String(total)}`}
        </p>
      )}

      {beforeStats}

      <ul className="flex flex-col gap-3">
        {round.stats.map((stat) => (
          <StatRow
            key={stat.key}
            stat={stat}
            answer={state.answers[stat.key]}
            disabled={isChecking || state.answers[stat.key] !== undefined}
            isOpen={openStat === stat.key}
            onOpen={() => {
              setOpenStat(stat.key);
            }}
          />
        ))}
      </ul>

      {isChecking && (
        <p className="text-sm text-muted" aria-live="polite">
          Puan hesaplanıyor…
        </p>
      )}

      {failure !== null && (
        <p
          role="alert"
          className="rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
        >
          {failure}
        </p>
      )}

      {openStat !== null &&
        openStatDto !== undefined &&
        searchForOpenStat !== null &&
        !finished && (
          <PlayerPicker
            label={`${openStatDto.label} için oyuncu seçin (hedef ${String(openStatDto.value)})`}
            usedPlayerIds={usedPlayerIds}
            search={searchForOpenStat}
            onSelect={(player) => {
              void submit(openStat, player);
            }}
            onCancel={() => {
              setOpenStat(null);
            }}
          />
        )}

      {finished && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm"
        >
          <p>
            Tur bitti — ortalama <strong>%{String(total)}</strong>.{" "}
            {date === undefined
              ? "Bu tur kaydedilmez."
              : `Yeni oyuncu her gün ${ROLLOVER_LABEL} (TSİ) yayınlanır.`}
          </p>
          {recording?.kind === "kayitli" && (
            <Link
              href="/lider-tablosu"
              className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Lider tablosunu gör
            </Link>
          )}
          {onRestart !== undefined && (
            <button
              type="button"
              className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={onRestart}
            >
              Başka oyuncu seç
            </button>
          )}
        </div>
      )}

      {/*
        KAPSAM BİLDİRİMİ (§1.3, §9.2). Maç/gol/kulüp sayıları yalnızca yirmi
        dört ligi kapsar; söylenmezse kullanıcı bildiği gerçek toplamla
        karşılaştırıp siteyi yanlış sanar.
      */}
      <p className="text-xs text-muted">
        <span aria-hidden="true">*</span> işaretli sayılar yalnızca kapsanan
        yirmi dört ligdeki kariyeri kapsar.
      </p>
    </div>
  );
}

interface StatRowProps {
  readonly stat: StatDto;
  readonly answer: StatMatchState["answers"][StatKey];
  readonly disabled: boolean;
  readonly isOpen: boolean;
  onOpen(): void;
}

/**
 * Sayı doğrusu — BR-18'in puanlama penceresini GÖRÜNÜR kılar.
 *
 * NEDEN VAR. Bu modun ölçülen zayıflığı, kuralının anlaşılmaması: kullanıcı
 * "435 maç" sayısını görüyor ama ne kadar yaklaşmanın yeteceğini bilmiyor,
 * deneyerek çözüyor. Doğru cevap bir NOKTA değil bir ARALIK ve o aralık
 * istatistikten istatistiğe değişiyor — kulüp sayısında ±2,4, kulüp maçında
 * ±222,8.
 *
 * ÖLÇEK UYDURULMADI, KURALDAN TÜRETİLDİ. Pencere `SCORE_TOLERANCE_FACTOR ×
 * STAT_DEVIATIONS[key]`, yani puanın sıfıra düştüğü uzaklık. Sabit bir ölçek
 * (ör. "0 – 800") aynı görüntüyü verirdi ama hiçbir şey anlatmazdı; bu ölçek
 * doğrudan oyunun kuralıdır. Uçlar bu yüzden SAYIYLA değil ANLAMLA
 * etiketleniyor: uçta durmak "puan yok" demek.
 *
 * Ekran okuyucuya gitmiyor (`aria-hidden`): hedef, seçilen değer ve puan
 * satırın metninde zaten yazılı. Aynı bilgiyi ikinci kez, üstelik konum
 * olarak anlatmak gürültü olurdu.
 *
 * İKİ İŞARET DOĞRUNUN İKİ YANINDA — ve bu bir düzenleme tercihi değil, bir
 * kusurun onarımı. İkisi de doğrunun ÜSTÜNDEYKEN "hedef" ile "senin"
 * etiketleri, tahmin hedefe yaklaştıkça üst üste biniyordu. Kusurun en kötü
 * yanı nerede ortaya çıktığıydı: İYİ CEVAPTA. Kullanıcı ne kadar yaklaşırsa
 * doğru o kadar okunmaz hâle geliyor, %100'lük bir tahminde iki etiket tam
 * olarak çakışıyordu. Hedef artık doğrunun üstünde, seçim altında; çakışma
 * geometrik olarak imkânsız.
 */
/**
 * Uçtaki etiketin kaptan taşmaması için hizası konuma göre değişir.
 *
 * Ortadaki işaret kendi ekseninde ortalanır; uca dayanan işaret ortalandığında
 * etiketin yarısı kabın dışında kalıyor ve komşu içeriğe giriyordu. Uçta
 * etiket işareti hizalanarak takip ediyor.
 */
function labelAnchor(at: number): string {
  if (at <= 6) return "translate-x-0";
  if (at >= 94) return "-translate-x-full";
  return "-translate-x-1/2";
}

export function NumberLine({
  statKey,
  target,
  chosen,
  score,
}: {
  statKey: StatKey;
  target: number;
  chosen?: number;
  score?: number;
}) {
  const tolerance = SCORE_TOLERANCE_FACTOR * STAT_DEVIATIONS[statKey];

  /** Değer → pencere içindeki yüzde konumu; pencere dışı uçta durur. */
  const position = (value: number): number => {
    // YUVARLANIYOR: kayan nokta aritmetiği tam uçta `99.99999999999999`
    // üretiyor ve o dize doğrudan `style`'a yazılıyordu. İki ondalık, alt
    // piksel hassasiyeti için fazlasıyla yeterli.
    const raw = ((value - target + tolerance) / (2 * tolerance)) * 100;
    return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
  };

  const chosenAt = chosen === undefined ? null : position(chosen);

  return (
    <div aria-hidden="true" className="relative mt-2 h-12 w-full">
      {/*
        ÜST SIRA — doğrunun künyesi: iki uç ve orta. "hedef" her zaman tam
        ortada, uç etiketleri kenarlarda; üçü sabit konumlu olduğu için
        birbirlerine hiçbir genişlikte değmiyorlar.
      */}
      <span className="absolute top-0 left-0 text-[0.5625rem] font-semibold tracking-wide text-muted uppercase">
        puan yok
      </span>
      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[0.5625rem] font-extrabold tracking-wide uppercase">
        hedef
      </span>
      <span className="absolute top-0 right-0 text-[0.5625rem] font-semibold tracking-wide text-muted uppercase">
        puan yok
      </span>

      {/* Hedefin sapı doğruya YUKARIDAN iner. */}
      <span className="absolute top-3 left-1/2 h-2.5 w-0.5 -translate-x-1/2 bg-foreground" />

      <span className="absolute top-[1.375rem] right-0 left-0 h-0.5 rounded bg-line" />

      {/* Hedefle seçim arasındaki açıklık; rengi puan bandından gelir. */}
      {chosenAt !== null && score !== undefined && (
        <span
          className={
            "absolute top-5 h-1.5 rounded-sm opacity-70 " +
            (score >= 80 ? "bg-correct" : score >= 50 ? "bg-warn" : "bg-wrong")
          }
          style={{
            left: `${String(Math.min(50, chosenAt))}%`,
            width: `${String(Math.abs(chosenAt - 50))}%`,
          }}
        />
      )}

      {/*
        İşaretler SAYI TAŞIMAZ, ad taşır. Hedef değeri hemen üstte 3xl puntoda,
        seçilen değer de rozette zaten yazılı; doğrunun üzerinde üçüncü kez
        basmak bilgi eklemez, yalnızca kalabalık yapar. Doğrunun anlattığı şey
        sayı değil KONUM.

        Seçimin sapı doğrudan AŞAĞIYA uzanıyor ve hedefinkinden kalın: iki
        işaret aynı noktada bile ayrı okunuyor — biri yukarıda, biri aşağıda.
      */}
      {chosenAt !== null && (
        <>
          <span
            className="absolute top-6 h-2.5 w-1 -translate-x-1/2 rounded-b-full bg-accent"
            style={{ left: `${String(chosenAt)}%` }}
          />
          <span
            className={
              "absolute top-9 text-[0.5625rem] font-extrabold tracking-wide text-accent uppercase " +
              labelAnchor(chosenAt)
            }
            style={{ left: `${String(chosenAt)}%` }}
          >
            senin
          </span>
        </>
      )}
    </div>
  );
}

function StatRow({ stat, answer, disabled, isOpen, onOpen }: StatRowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card">
      <span className="flex flex-col">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          {stat.label}
          {stat.scoped && (
            <>
              <span aria-hidden="true">*</span>
              <span className="sr-only"> (yalnızca yirmi dört lig)</span>
            </>
          )}
        </span>
        {/* Hedef sayı ekranın SORUSUDUR; etiketiyle aynı ağırlıkta durduğunda
            hangi değeri yakalamaya çalıştığınız bir bakışta okunmuyordu. */}
        <span className="text-3xl font-bold text-accent tabular-nums">
          {String(stat.value)}
        </span>
      </span>

      {answer === undefined ? (
        <button
          type="button"
          disabled={disabled}
          aria-expanded={isOpen}
          className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onOpen}
        >
          Oyuncu seç
          <span className="sr-only"> — {stat.label}</span>
        </button>
      ) : (
        <span className="flex flex-col items-end gap-1 text-sm">
          <span className="font-semibold">{answer.playerName}</span>
          {/* Puan bandı RENKLE de gösterilir ama renk tek gösterge değildir
              (WCAG 1.4.1): yüzde zaten rozetin metninde yazılı. */}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreTone(
              answer.score,
            )}`}
          >
            {String(answer.value)} · %{String(answer.score)}
          </span>
          <span className="sr-only">
            {stat.label}: {answer.playerName}, değeri {String(answer.value)},
            puan yüzde {String(answer.score)}
          </span>
        </span>
      )}

      {/*
        Sayı doğrusu satırın TAMAMINI kaplar (`basis-full`): hedefin ve
        seçimin konumu ancak tam genişlikte okunur. Cevaptan önce de duruyor —
        asıl işi zaten o an görüyor, yani "ne kadar yaklaşmam gerekiyor"
        sorusunu seçim yapılmadan ÖNCE yanıtlıyor.
      */}
      <span className="basis-full">
        <NumberLine
          statKey={stat.key}
          target={stat.value}
          chosen={answer?.value}
          score={answer?.score}
        />
      </span>
    </li>
  );
}
