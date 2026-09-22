"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  WhichMoreAnswerDto,
  WhichMorePairDto,
  WhichMorePlayerDto,
  WhichMoreRoundDto,
} from "@/application/use-cases/which-more";
import { DataLabel } from "./data-label";
import { ModeHeader, Scoreboard } from "./mode-header";
import { Button } from "./ui/button";
import { STAT_KEYS, type StatKey } from "@/domain/services/stat-match";
import {
  LEVELS,
  MIN_GAP,
  type Direction,
  type Level,
} from "@/domain/services/which-more";

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
  /**
   * Yön düğmesinde GÖRÜNEN kısa biçim; erişilebilir ad tam cümle KALIR.
   *
   * Kurulum ekranında cümlenin tamamı zaten önizlemede duruyor; düğmede
   * ikinci kez basmak seçimi bir cümle yığınına çeviriyordu. Kısa biçim tam
   * cümlenin İÇİNDE geçtiği için WCAG 2.5.3 (Label in Name) sağlanıyor.
   */
  readonly moreShort: string;
  readonly lessShort: string;
  /** Değerin yanına yazılan birim. */
  readonly unit: string;
  /**
   * BANT metnindeki birim ("en az 5 … fark"), farklıysa.
   *
   * Beş istatistikte `unit` ile aynı ve verilmez. Doğum yılında AYRIŞIYOR:
   * değerin yanında "1985 doğumlu" doğru okunur ama "en az 5 doğumlu fark"
   * anlamsızdır — orada birim yıldır. Tek alanı iki bağlamda kullanmak bu
   * istatistikte cümleyi bozuyordu.
   */
  readonly gapUnit?: string;
  /** §9.2'nin kapsam bildirimi: yalnızca 24 ligi mi sayıyor? */
  readonly scoped: boolean;
}

/**
 * Etiketler SUNUM tarafındadır (§6.5): anahtarlar sözleşmenin parçası, bu
 * cümleler değil. Yön başına ayrı cümle var çünkü Türkçede "daha az uzun"
 * diye bir şey yok — karşıtı "daha kısa".
 */
const QUESTIONS: readonly StatQuestion[] = [
  /**
   * ADLAR SAYININ KAPSAMINI ANLATIR (BR-23). "Kulüp maçı"ydı; 22 Ağustos
   * 2026'da sayı kulüp kariyerinin tamamına + A millî takıma geçince ad da
   * geçti. Millî takım golünü "kulüp golü" diye sunmak, kullanıcının
   * doğrulayabileceği bir yalan olurdu.
   */
  {
    key: "appearances",
    name: "Resmî maç",
    more: "daha çok resmî maça çıktı",
    less: "daha az resmî maça çıktı",
    moreShort: "daha çok",
    lessShort: "daha az",
    unit: "maç",
    scoped: false,
  },
  {
    key: "goals",
    name: "Resmî gol",
    more: "daha çok resmî gol attı",
    less: "daha az resmî gol attı",
    moreShort: "daha çok",
    lessShort: "daha az",
    unit: "gol",
    scoped: false,
  },
  {
    key: "clubs",
    name: "Oynadığı kulüp",
    more: "daha çok kulüpte oynadı",
    less: "daha az kulüpte oynadı",
    moreShort: "daha çok",
    lessShort: "daha az",
    unit: "kulüp",
    scoped: true,
  },
  {
    key: "nationalCaps",
    name: "A millî maç",
    more: "daha çok A millî maça çıktı",
    less: "daha az A millî maça çıktı",
    moreShort: "daha çok",
    lessShort: "daha az",
    unit: "millî maç",
    scoped: false,
  },
  {
    key: "heightCm",
    name: "Boy",
    more: "daha uzun",
    less: "daha kısa",
    moreShort: "daha uzun",
    lessShort: "daha kısa",
    unit: "cm",
    scoped: false,
  },
  /**
   * YÖN BURADA TERSİNE DÖNER ve bu satırların en kolay yanlış yazılan yeri.
   *
   * `more` = DEĞERİ büyük olan demektir. Doğum yılında büyük değer daha GEÇ
   * doğmuş, yani daha GENÇ olandır. "more: daha yaşlı" yazmak sezgisel gelir
   * ve oyunu baştan sona ters çevirirdi: kullanıcı doğru bildiği her turda
   * yanlış cevap alırdı. Diğer beş istatistikte büyük değer "daha çok" ile
   * aynı yöne baktığı için bu tuzak yalnızca burada var.
   */
  {
    key: "birthYear",
    name: "Doğum yılı",
    more: "daha genç",
    less: "daha yaşlı",
    moreShort: "daha genç",
    lessShort: "daha yaşlı",
    unit: "doğumlu",
    gapUnit: "yıl",
    scoped: false,
  },
];

/**
 * Kapsamdan bağımsız sayıların NEYİ topladığını söyleyen not (BR-23).
 *
 * Kapsam uyarısının simetriği: "24 lig" uyarısı kalktığında yerine hiçbir şey
 * koymamak, kullanıcıyı 830 gollük bir sayıyla açıklamasız bırakırdı. Boy ve
 * doğum yılında not YOK — o sayılar zaten tek anlama geliyor.
 *
 * SEÇİM ANINDA GÖRÜNÜR: kurulum ekranı kalktığı için bu not artık canlı sorunun
 * altında duruyor ve metrik değişince anında güncelleniyor — eski öbek
 * başlıklarının ("Kapsama bağlı") işini üstlendi.
 */
function scopeNoteFor(key: StatKey): ReactNode {
  if (key !== "appearances" && key !== "goals") return null;

  return (
    <p className="text-sm text-note">
      Kulüp kariyerinin tamamı (lig, kupa, Avrupa) ile A millî takım toplamı.
    </p>
  );
}

/**
 * BR-41'in seviyelerinin ARAYÜZ karşılığı.
 *
 * Anahtarlar sözleşmenin parçası, bu cümleler değil (§6.5) — `QUESTIONS` ile
 * aynı ayrım.
 *
 * `detail` BİR VAAT DEĞİL, ÖLÇÜTÜN KENDİSİDİR. "Bildiğin oyuncular" demek
 * yanlış olurdu: kolay havuzun ölçülen %33'ü hâlâ dar bir kitlece tanınıyor
 * (§9.3). Ölçütü yazmak kullanıcıya neyi seçtiğini söyler ve tutulamayacak bir
 * söz vermez — §5.2'nin dürüstlük metinleriyle aynı sınıf.
 */
interface LevelOption {
  readonly key: Level;
  readonly name: string;
  readonly detail: string;
  /** Kurulum önizlemesinde ve tur ekranında sorunun altına yazılan not. */
  readonly note: string;
}

const LEVEL_OPTIONS: readonly LevelOption[] = [
  {
    key: "easy",
    name: "Kolay",
    detail: "A millî takımda 20+ maç yapmış, 2000 sonrasında oynamış oyuncular",
    note: "Bilindik oyuncular arasından",
  },
  {
    key: "hard",
    name: "Zor",
    detail: "Havuzun tamamı — adını hiç duymadığın isimler de çıkar",
    note: "Bütün oyuncular arasından",
  },
];

function levelFor(key: Level): LevelOption {
  const found = LEVEL_OPTIONS.find((one) => one.key === key);
  if (found === undefined) throw new Error(`Etiketsiz seviye: ${key}`);
  return found;
}

function questionFor(key: StatKey): StatQuestion {
  // STAT_KEYS ile QUESTIONS aynı altı anahtarı taşır; bulunamama hâli tip
  // düzeyinde imkânsız ama `noUncheckedIndexedAccess` altında kanıtlanmalı.
  const found = QUESTIONS.find((one) => one.key === key);
  if (found === undefined) throw new Error(`Etiketsiz istatistik: ${key}`);
  return found;
}

type Phase =
  // KURULUM EVRESİ YOK (§9.3): Stitch gibi, sayfa doğrudan canlı düelloya
  // açılır. Metrik/havuz/yön satır içi kontrollerdir; ilk tur mount'ta yüklenir.
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
  /**
   * BR-41 — VARSAYILAN "easy".
   *
   * Modun var olma sebebi kolay havuz; hiç seçim yapmayan kullanıcı düzeltilmiş
   * davranışı görmeli, düzeltilmek istenen davranışı değil.
   */
  const [level, setLevel] = useState<Level>("easy");
  const [direction, setDirection] = useState<Direction>("more");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
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
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const question = questionFor(statKey);

  const loadRound = useCallback(
    async (
      key: StatKey,
      chosenLevel: Level,
      stayingId: string | null,
      exclude: readonly string[],
    ) => {
      setPhase({ kind: "loading" });
      try {
        // Seviye HER TURDA gönderilir: sunucu koşuyu hatırlamıyor (§9.3).
        const round = await fetchRound({
          statKey: key,
          level: chosenLevel,
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

  /**
   * KOŞUYU SIFIRLAYIP YENİ AYARLARLA BAŞLAT (§9.3).
   *
   * Kurulum ekranı olmadığı için "başlamak" ile "ayar değiştirmek" aynı işlem:
   * her ikisi de seriyi sıfırlar ve taze bir tur yükler. Metrik/havuz/yön
   * değişince koşu SIFIRLANIR — seri o ayara aittir (Stitch dili, Seçenek 1).
   */
  const startWith = useCallback(
    (key: StatKey, chosenLevel: Level): void => {
      setStreak(0);
      setSeen([]);
      setKeptId(null);
      setShareStatus(null);
      void loadRound(key, chosenLevel, null, []);
    },
    [loadRound],
  );

  /**
   * İLK TUR MOUNT'TA YÜKLENİR — kurulum ekranı yok. `ref` ile bir kez: `fetchRound`
   * varsayılanı her render'da yeni bir fonksiyon olduğu için `loadRound` da
   * değişir; muhafız olmadan efekt her render'da yeniden yüklenirdi.
   */
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void loadRound(statKey, level, null, []);
  }, [loadRound, statKey, level]);

  function changeStat(key: StatKey): void {
    setStatKey(key);
    startWith(key, level);
  }

  function changeLevel(next: Level): void {
    setLevel(next);
    startWith(statKey, next);
  }

  function changeDirection(next: Direction): void {
    setDirection(next);
    // Havuz aynı ama soru terse döndü; seri o yönde kazanıldığı için sıfırlanır.
    startWith(statKey, level);
  }

  function restart(): void {
    startWith(statKey, level);
  }

  /**
   * SERİYİ PAYLAŞ (§9.3) — mevcut koşunun sonucu.
   *
   * NADİRLİK/SIRALAMA YOK: yalnızca seri sayısı + seçilen metrik/seviye. İşaret
   * şeridi seri kadar 🟩, koşu bir yanlışla bittiyse sonuna 🟥. Emoji yalnızca
   * PAYLAŞ METNİNDE (§7.12); ızgara/istatistikle aynı kural.
   */
  const share = useCallback(async (): Promise<void> => {
    const q = questionFor(statKey);
    const lvl = levelFor(level);
    const endedWrong = phase.kind === "revealed" && !phase.answer.correct;
    // Uzun serilerde satır taşmasın; işaret şeridi yalnızca bir özet.
    const marks = "🟩".repeat(Math.min(streak, 30)) + (endedWrong ? "🟥" : "");
    const head = "Futbol Challenge — Hangisi Daha";
    const line = `${String(streak)} doğru üst üste · ${q.name} (${lvl.name})`;
    const url = `${window.location.origin}/hangisi-daha`;
    const text = [head, line, "", marks, "", url].join("\n");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setShareStatus("Paylaşıldı.");
        return;
      } catch {
        // iptal / hata: panoya kopyalamaya düş.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Skor panoya kopyalandı.");
    } catch {
      setShareStatus("Paylaşım bu tarayıcıda desteklenmiyor.");
    }
  }, [statKey, level, phase, streak]);

  /*
    KÜNYE OYUN BİLEŞENİNİN İÇİNDE (§7.15). Seri sayacı istemci durumundan
    geliyor — sunucu sayfası onu bilemezdi. Kurulum evresi olmadığı için tabela
    HER ZAMAN basılıyor: ilk düellonun kendisi boş durum (Seri 0), tıpkı
    ızgaranın 0/9'u gibi.
  */
  const modeHeader = (
    <ModeHeader
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
      // HIZLI KISAYOLLAR — "Nasıl oynanır" çapası her zaman; "Seriyi paylaş"
      // yalnızca paylaşılacak bir seri varken (§9.3). Izgara/istatistikteki
      // künye kısayollarının karşılığı.
      actions={
        <WhichMoreHeaderLinks
          onShare={streak > 0 ? share : undefined}
          shareStatus={shareStatus}
        />
      }
      scoreboard={
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
      }
    />
  );

  // İki değerin farkı — cevap açılınca "Aradaki fark" şeridinde yazılır (§9.3).
  const revealedGap =
    phase.kind === "revealed"
      ? Math.abs(phase.answer.left.value - phase.answer.right.value)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">{modeHeader}</div>

      {/*
        SATIR İÇİ KONTROLLER (§9.3) — kurulum ekranının yerine. Metrik/havuz/yön
        düellonun üstünde; birine dokununca koşu SIFIRLANIR ve taze bir tur
        yüklenir. Stitch'in "kurulum yok, direkt oyun" hissi, ama Kolay/Zor ve
        yön korunarak (Stitch bunları atmıştı — bizde gerçek özellik).
      */}
      <WhichMoreControls
        statKey={statKey}
        level={level}
        direction={direction}
        question={question}
        onStat={changeStat}
        onLevel={changeLevel}
        onDirection={changeDirection}
      />

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

        {/*
          HANGİ HAVUZDA OYNANDIĞI TUR EKRANINDA DA YAZAR. Seviye satır içi
          kontrolden seçiliyor; yazılmasaydı kullanıcı tanımadığı bir isim
          gördüğünde bunun modun kusuru mu yoksa kendi seçimi mi olduğunu
          bilemezdi.
        */}
        <p className="text-sm text-note">{levelFor(level).note}</p>

        {question.scoped ? (
          <p className="text-sm text-note">
            Bu sayı yalnızca kapsamdaki 24 ligi sayar.
          </p>
        ) : (
          scopeNoteFor(statKey)
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
            ARADAKİ FARK (§9.3) — Stitch'in VS rozetindeki "+142 FARK"ın
            karşılığı, iki kartın altında ortalı. Birim `gapUnit`'ten: doğum
            yılında "yıl", değerin yanındaki "doğumlu" değil. Cevap açıldığında
            (iki değer de görünürken) beliriyor.
          */}
          {revealedGap !== null && (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-1.5">
                <DataLabel className="text-muted">Aradaki fark</DataLabel>
                <span className="font-display text-base font-bold tabular-nums">
                  {String(revealedGap)} {question.gapUnit ?? question.unit}
                </span>
              </span>
            </div>
          )}

          {/*
            SONUÇ CANLI BÖLGEDE. Doğru/yanlış yalnızca renkle anlatılsaydı
            ekran okuyucu kullanıcısı hiçbir şey duymazdı (§7.10).
          */}
          <div aria-live="polite">
            {phase.kind === "revealed" &&
              (phase.answer.correct ? (
                <VerdictBar
                  streak={streak}
                  winnerName={
                    phase.answer.winnerId === phase.pair.left.id
                      ? phase.pair.left.name
                      : phase.pair.right.name
                  }
                  winnerValue={
                    phase.answer.winnerId === phase.answer.left.id
                      ? phase.answer.left.value
                      : phase.answer.right.value
                  }
                  unit={question.unit}
                  onContinue={() => {
                    void loadRound(statKey, level, phase.answer.winnerId, seen);
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
        <span className="font-display text-lg leading-tight font-bold tracking-tight">
          {player.name}
        </span>

        {chain !== null && (
          <span
            className={
              "shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-extrabold tracking-[0.13em] uppercase " +
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
            {/* Açılan değer düellonun doruğu; condensed editorial yüz (§7.12),
                tabelayla + öbür modlarla aynı tabular-nums ritmi. Ağırlık 700
                (yüklü); 900 sentetik olurdu. Birim iç içe span'de font-display'i
                miras alır. */}
            <span className="font-display text-4xl leading-none font-bold tabular-nums">
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
  winnerName,
  winnerValue,
  unit,
  onContinue,
}: {
  readonly streak: number;
  /** Kazanan kart = kullanıcının doğru seçtiği oyuncu (BR-28). */
  readonly winnerName: string;
  readonly winnerValue: number;
  readonly unit: string;
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
        {/* KAZANANI ADIYLA SÖYLER (Stitch dili): "Doğru!" tek başına hangi
            kartın önde olduğunu söylemiyordu — kart rozetleri söylüyor ama
            verdict cümlesi de artık taşıyor. */}
        <p className="text-sm text-muted">
          <strong className="font-semibold text-foreground">
            {winnerName}
          </strong>{" "}
          önde —{" "}
          <span className="tabular-nums text-foreground">
            {String(winnerValue)} {unit}
          </span>
          .
        </p>
        {band !== null && <p className="text-sm text-muted">{band}</p>}
      </div>

      <Button size="lg" onClick={onContinue}>
        Devam
      </Button>
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
        <Button size="md" onClick={onRestart}>
          Yeniden başla
        </Button>
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
          className="rounded-lg border border-line-strong px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onRestart}
        >
          Yeniden başla
        </button>
      </div>
    </div>
  );
}

interface WhichMoreControlsProps {
  readonly statKey: StatKey;
  readonly level: Level;
  readonly direction: Direction;
  readonly question: StatQuestion;
  onStat(key: StatKey): void;
  onLevel(level: Level): void;
  onDirection(direction: Direction): void;
}

/** Segment pill sınıfı — seçili DOLU, seçilmemiş çerçeveli (renk tek gösterge değil). */
function controlPillClass(isCurrent: boolean): string {
  return (
    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent " +
    (isCurrent
      ? "border-accent bg-accent font-semibold text-accent-fg shadow-card"
      : "border-line-strong bg-surface font-medium text-muted hover:border-accent hover:text-foreground")
  );
}

/**
 * Satır içi kontroller — kurulum ekranının yerine (§9.3, Stitch dili).
 *
 * Üç seçim (metrik / havuz / yön) düellonun üstünde tek bir sıkı kartta;
 * "Başla" YOK — birine dokununca koşu sıfırlanıp taze tur yüklenir. Stitch'in
 * "kurulum yok, direkt oyun" hissini verir ama Kolay/Zor ve yönü KORUR: Stitch
 * bunları atmıştı, oysa bizde gerçek özellik (BR-41 + iki yön).
 *
 * ERİŞİLEBİLİRLİK: her seçenek bir radyo; görünen etiket kısa, BR-29 bandı /
 * havuz ölçütü / yön cümlesi erişilebilir adın PARÇASI (sr-only). Pill göze
 * sade kalırken ekran okuyucu kullanıcısı ölçütü tam duyuyor (WCAG 2.5.3);
 * kapsam da seçim ANINDA canlı sorunun altındaki notta görünüyor.
 */
function WhichMoreControls({
  statKey,
  level,
  direction,
  question,
  onStat,
  onLevel,
  onDirection,
}: WhichMoreControlsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <fieldset className="flex flex-col gap-2">
        <DataLabel as="legend" className="text-muted">
          Metrik
        </DataLabel>
        <div className="flex flex-wrap gap-2">
          {STAT_KEYS.map((key) => {
            const one = questionFor(key);
            const isCurrent = key === statKey;
            return (
              <label key={key} className={controlPillClass(isCurrent)}>
                <input
                  type="radio"
                  name="which-more-stat"
                  className="sr-only"
                  value={key}
                  checked={isCurrent}
                  onChange={() => {
                    onStat(key);
                  }}
                />
                <span>{one.name}</span>
                {/* BR-29 bandı + kapsam erişilebilir adın PARÇASI: pill göze sade
                    kalır, ölçüt ekran okuyucuda tam duyulur (kapsam ayrıca canlı
                    notta). */}
                <span className="sr-only">
                  {" — en az "}
                  {String(MIN_GAP[key])} {one.gapUnit ?? one.unit} fark
                  {one.scoped ? ", yalnızca 24 lig" : ""}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <fieldset className="flex flex-col gap-2">
          <DataLabel as="legend" className="text-muted">
            Havuz
          </DataLabel>
          <div className="flex gap-2">
            {LEVELS.map((option) => {
              const one = levelFor(option);
              const isCurrent = option === level;
              return (
                <label key={option} className={controlPillClass(isCurrent)}>
                  <input
                    type="radio"
                    name="which-more-level"
                    className="sr-only"
                    value={option}
                    checked={isCurrent}
                    onChange={() => {
                      onLevel(option);
                    }}
                  />
                  <span>{one.name}</span>
                  {/* Ölçüt erişilebilir adın parçası: "Kolay" tek başına neyin
                      kolay olduğunu söylemez. */}
                  <span className="sr-only"> — {one.detail}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <DataLabel as="legend" className="text-muted">
            Yön
          </DataLabel>
          <div className="flex gap-2">
            {(["more", "less"] as const).map((option) => {
              const isCurrent = option === direction;
              return (
                <label key={option} className={controlPillClass(isCurrent)}>
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
                  {/* GÖRÜNEN kısa, DUYULAN tam (WCAG 2.5.3): kısa biçim tam
                      cümlenin içinde geçer. */}
                  <span aria-hidden="true">
                    {option === "more"
                      ? question.moreShort
                      : question.lessShort}
                  </span>
                  <span className="sr-only">
                    {option === "more" ? question.more : question.less}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function describe(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Beklenmeyen bir hata oluştu.";
}

/** Künye kısayol düğmesi — condensed pill (ızgara/istatistikteki idyom). */
const HEADER_LINK_CLASS =
  "font-display inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-2 text-sm font-semibold tracking-wide text-muted uppercase transition-colors hover:border-line-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Künye kısayolları — "Nasıl oynanır" çapası ve "Seriyi paylaş" (§9.3).
 *
 * `onShare` verilmezse paylaş düğmesi çıkmaz (paylaşılacak bir seri yok). Çapa
 * sayfanın altındaki bölüme iner; ikonlar satır içi SVG (§7.12: harici
 * font/glif değil, CSP `font-src 'self'`).
 */
function WhichMoreHeaderLinks({
  onShare,
  shareStatus,
}: {
  readonly onShare?: () => void;
  readonly shareStatus: string | null;
}) {
  return (
    <nav
      aria-label="Hangisi daha kısayolları"
      className="flex flex-wrap items-center gap-2"
    >
      <a href="#nasil-oynanir" className={HEADER_LINK_CLASS}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.3" />
          <path d="M12 17h.01" />
        </svg>
        <span>Nasıl oynanır?</span>
      </a>

      {onShare !== undefined && (
        <button type="button" className={HEADER_LINK_CLASS} onClick={onShare}>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            className="h-4 w-4 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="M12 15V3M8 7l4-4 4 4" />
          </svg>
          <span>Seriyi paylaş</span>
        </button>
      )}

      {shareStatus !== null && (
        <span role="status" aria-live="polite" className="text-sm text-muted">
          {shareStatus}
        </span>
      )}
    </nav>
  );
}
