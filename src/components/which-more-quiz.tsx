"use client";

import { useCallback, useState, type ReactNode } from "react";
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
 * İKİ EKRANLI AKIŞ (Stitch tasarımı). Ekran A KURULUM: metrik/havuz/yön seçilir,
 * "Başla" ilk turu yükler. Ekran B DÜELLO: soru, iki kart, sonuç. "Ayarları
 * değiştir" kuruluma döner ve koşuyu sıfırlar. Ayrıntı §9.3'ün "Kurulum ekranı:
 * iki ekranlı akış" alt-bölümünde.
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
  /** Kurulum kartındaki tek satırlık açıklama. */
  readonly hint: string;
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
   * BANT/FARK metnindeki birim ("en az 5 … fark"), farklıysa.
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
export const QUESTIONS: readonly StatQuestion[] = [
  /**
   * ADLAR SAYININ KAPSAMINI ANLATIR (BR-23). "Kulüp maçı"ydı; 22 Ağustos
   * 2026'da sayı kulüp kariyerinin tamamına + A millî takıma geçince ad da
   * geçti. Millî takım golünü "kulüp golü" diye sunmak, kullanıcının
   * doğrulayabileceği bir yalan olurdu.
   */
  {
    key: "appearances",
    name: "Resmî maç",
    hint: "Kulüp kariyerinin tamamı ile A millî takım toplamı.",
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
    hint: "Kulüp kariyerinin tamamı ile A millî takım toplamı.",
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
    hint: "Bu sayı yalnızca kapsamdaki 24 ligi sayar.",
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
    hint: "A millî takım maç sayısı.",
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
    hint: "cm cinsinden resmî boy.",
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
    hint: "Doğum yılına göre karşılaştırma.",
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
 * DÜELLO EKRANINDA, sorunun altında: seviye notuyla birlikte hangi havuzda ve
 * hangi kapsamda oynandığını söyler.
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

export const LEVEL_OPTIONS: readonly LevelOption[] = [
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

export function levelFor(key: Level): LevelOption {
  const found = LEVEL_OPTIONS.find((one) => one.key === key);
  if (found === undefined) throw new Error(`Etiketsiz seviye: ${key}`);
  return found;
}

export function questionFor(key: StatKey): StatQuestion {
  // STAT_KEYS ile QUESTIONS aynı altı anahtarı taşır; bulunamama hâli tip
  // düzeyinde imkânsız ama `noUncheckedIndexedAccess` altında kanıtlanmalı.
  const found = QUESTIONS.find((one) => one.key === key);
  if (found === undefined) throw new Error(`Etiketsiz istatistik: ${key}`);
  return found;
}

type Phase =
  // KURULUM (§9.3): başlangıç evresi. "Başla" ile ilk tur yüklenir; "Ayarları
  // değiştir" buraya geri döner ve koşuyu sıfırlar.
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
  /**
   * KURULUM EKRANINA KONUMSAL YUVA — §12.8 (İstatistik'teki `beforeStats`
   * deseni, §12.7). Odaya çağrı şeridi (`RoomEntryBar`) buraya geliyor: sunucu
   * sayfası girişi ve hesap özelliğinin açık olup olmadığını bildiği için şerit
   * ORADA kuruluyor, oyun bileşeni odayı tanımak zorunda kalmıyor. Yalnızca
   * kurulum ekranında (Ekran A) gösterilir — düello sürerken bir "arkadaşına
   * karşı oyna" çağrısı koşunun önüne geçerdi.
   */
  roomEntry?: ReactNode;
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
  roomEntry,
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
   * KOŞUYU SIFIRLAYIP İLK TURU YÜKLE — "Başla" ve "Yeniden başla" (§9.3).
   *
   * Kurulum ekranından düelloya geçişin tek yolu budur: seriyi ve görülenleri
   * sıfırlar, güncel metrik/havuz ile taze bir tur ister.
   */
  const start = useCallback((): void => {
    setStreak(0);
    setSeen([]);
    setKeptId(null);
    setShareStatus(null);
    void loadRound(statKey, level, null, []);
  }, [loadRound, statKey, level]);

  /**
   * KURULUMA DÖN — "Ayarları değiştir" (§9.3).
   *
   * Ayrı bir kurulum ekranı olduğu için ayarlar orada değişir; düelloda değil.
   * Koşu da sıfırlanır (seri o ayara aittir), böylece kuruluma dönen kullanıcı
   * yarım bir seriyle karışmış bir tabelayla karşılaşmaz.
   */
  function openSetup(): void {
    setStreak(0);
    setSeen([]);
    setKeptId(null);
    setShareStatus(null);
    setPhase({ kind: "setup" });
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

  // EKRAN A — KURULUM. Ayrı bir ekran (§9.3): tabela yok, henüz koşu yok.
  if (phase.kind === "setup") {
    return (
      <WhichMoreSetup
        statKey={statKey}
        level={level}
        direction={direction}
        question={question}
        onStat={setStatKey}
        onLevel={setLevel}
        onDirection={setDirection}
        onStart={start}
        roomEntry={roomEntry}
      />
    );
  }

  /*
    EKRAN B — DÜELLO. Künye OYUN BİLEŞENİNİN İÇİNDE (§7.15): seri sayacı istemci
    durumundan geliyor, sunucu sayfası onu bilemezdi. Tabela düelloya girildiği
    an basılıyor ve ilk düello boş durumdur (Seri 0), ızgaranın 0/9'u gibi.
    Üst-etiket seçilen ayarı taşır ("Kolay · Resmî maç") — künyeyi ekleyen tek
    gerçek bilgi (§7.15 eyebrow kuralı).
  */
  const modeHeader = (
    <ModeHeader
      eyebrow={`${levelFor(level).name} · ${question.name}`}
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
      // HIZLI KISAYOLLAR — "Ayarları değiştir" (kuruluma dön) ve "Nasıl oynanır"
      // her zaman; "Seriyi paylaş" yalnızca paylaşılacak bir seri varken (§9.3).
      actions={
        <WhichMoreHeaderLinks
          onOpenSetup={openSetup}
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

  // İki değerin farkı — cevap açılınca "Aradaki fark" şeridinde ve kart başına
  // "önde/geride" olarak yazılır (§9.3).
  const revealedGap =
    phase.kind === "revealed"
      ? Math.abs(phase.answer.left.value - phase.answer.right.value)
      : null;
  const gapUnit = question.gapUnit ?? question.unit;

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

        {/*
          HANGİ HAVUZDA OYNANDIĞI TUR EKRANINDA DA YAZAR. Seviye kurulumdan
          seçiliyor; yazılmasaydı kullanıcı tanımadığı bir isim gördüğünde
          bunun modun kusuru mu yoksa kendi seçimi mi olduğunu bilemezdi.
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
        <ErrorPanel message={phase.message} onRestart={start} />
      )}

      {phase.kind === "exhausted" && (
        <OverPanel
          title="Havuz tükendi"
          detail="Bu istatistikte sunulabilecek yeni bir eşleşme kalmadı."
          streak={streak}
          tone="note"
          onRestart={start}
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
                    metricName={question.name}
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
                    // KART BAŞINA FARK (§9.3) — Stitch'in "+11 maç fazlası /
                    // 11 maç geride"si, ama yönden bağımsız: kazanan "önde",
                    // kaybeden "geride". Kazanan = cevabın winnerId'si.
                    lead={
                      phase.kind === "revealed" && revealedGap !== null
                        ? {
                            gap: revealedGap,
                            unit: gapUnit,
                            ahead: phase.answer.winnerId === player.id,
                          }
                        : null
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
            karşılığı, iki kartın altında ortalı bir şerit. Birim `gapUnit`'ten:
            doğum yılında "yıl", değerin yanındaki "doğumlu" değil. Cevap
            açıldığında (iki değer de görünürken) beliriyor.
          */}
          {revealedGap !== null && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-line bg-surface-2 px-4 py-2.5">
              <span className="inline-flex items-center gap-2">
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
                  <path d="M7 8h13M7 8l3-3M7 8l3 3" />
                  <path d="M17 16H4m13 0l-3-3m3 3l-3 3" />
                </svg>
                <DataLabel className="text-muted">Aradaki fark</DataLabel>
              </span>
              <span className="font-display text-base font-bold tabular-nums">
                {String(revealedGap)} {gapUnit}
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
                  loserName={
                    phase.answer.winnerId === phase.pair.left.id
                      ? phase.pair.right.name
                      : phase.pair.left.name
                  }
                  loserValue={
                    phase.answer.winnerId === phase.answer.left.id
                      ? phase.answer.right.value
                      : phase.answer.left.value
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
                  onRestart={start}
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

/** Kartın cevaptaki farkı — kazanan "önde", kaybeden "geride" (§9.3). */
interface Lead {
  readonly gap: number;
  readonly unit: string;
  readonly ahead: boolean;
}

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
  /** Değer plakasının üstündeki metrik etiketi (ör. "Resmî maç"). */
  readonly metricName: string;
  readonly unit: string;
  /** `null` = değer henüz açılmadı (BR-32). */
  readonly value: number | null;
  /** Karşılaştırma çubuğunun oranı (0–1); değer kapalıyken kullanılmaz. */
  readonly share: number;
  readonly outcome: Outcome;
  /** Kart başına fark — kazanan "önde", kaybeden "geride"; kapalıyken `null`. */
  readonly lead: Lead | null;
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
  metricName,
  unit,
  value,
  share,
  outcome,
  lead,
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
        ÇEVİRME hâline getiriyor. Metrik etiketi (ör. "Resmî maç") plakanın
        üstünde: hangi sayının okunduğunu söyler ("doğrulanmış" demez — biz
        doğrulamıyoruz, bir anlık görüntü topluyoruz, §5.2).
      */}
      <span className="flex w-full flex-col gap-1.5">
        <DataLabel className="text-muted">{metricName}</DataLabel>
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
      </span>

      {/*
        KART BAŞINA FARK. Açılan iki sayının karşılaştırmasını sözle söyler:
        kazanan "N önde", kaybeden "N geride". `aria-hidden` DEĞİL — "aradaki
        fark" şeridi tek bir sayı verir, bu her kartın kendi yönünü söyler.
      */}
      {lead !== null && (
        <span
          className={
            "text-xs font-bold tabular-nums " +
            (lead.ahead ? "text-accent" : "text-muted")
          }
        >
          {String(lead.gap)} {lead.unit} {lead.ahead ? "önde" : "geride"}
        </span>
      )}

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
  loserName,
  loserValue,
  unit,
  onContinue,
}: {
  readonly streak: number;
  /** Kazanan kart = kullanıcının doğru seçtiği oyuncu (BR-28). */
  readonly winnerName: string;
  readonly winnerValue: number;
  /** Kaybeden kart — Stitch dili: "(Zlatan: 164 maç)". */
  readonly loserName: string;
  readonly loserValue: number;
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
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-lg font-extrabold text-correct">Doğru!</span>
          {/* +1 seri puanı — Stitch dili; seri gerçekten +1 arttı (BR-28). */}
          <span className="rounded-full bg-correct px-2 py-0.5 text-[0.65rem] font-extrabold tracking-wide text-background uppercase">
            +1 seri puanı
          </span>
        </p>
        {/* KAZANANI ADIYLA + DEĞERİYLE, kaybedeni de değeriyle söyler (Stitch
            dili): "Doğru!" tek başına hangi kartın önde olduğunu söylemiyordu. */}
        <p className="mt-0.5 text-sm text-muted">
          <strong className="font-semibold text-foreground">
            {winnerName}
          </strong>{" "}
          önde —{" "}
          <span className="tabular-nums text-foreground">
            {String(winnerValue)} {unit}
          </span>{" "}
          · {loserName}{" "}
          <span className="tabular-nums">
            {String(loserValue)} {unit}
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

interface WhichMoreSetupProps {
  readonly statKey: StatKey;
  readonly level: Level;
  readonly direction: Direction;
  readonly question: StatQuestion;
  onStat(key: StatKey): void;
  onLevel(level: Level): void;
  onDirection(direction: Direction): void;
  onStart(): void;
  /** Odaya çağrı şeridi — giriş bloğundan sonra, adımlardan önce (§12.8). */
  readonly roomEntry?: ReactNode;
}

/** Kurulum kartı sınıfı — seçili DOLU, seçilmemiş çerçeveli (renk tek gösterge değil). */
function setupCardClass(isCurrent: boolean): string {
  return (
    "cursor-pointer rounded-lg border-2 p-4 text-left transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent " +
    (isCurrent
      ? "border-accent bg-accent-soft shadow-card"
      : "border-line bg-surface hover:border-line-strong")
  );
}

/**
 * EKRAN A — KURULUM (§9.3, Stitch tasarımı).
 *
 * Üç adım (metrik / havuz / yön) + bir soru önizlemesi + "Başla". Tabela YOK:
 * henüz koşu yok. "Başla" ilk turu yükler ve düelloya geçer.
 *
 * ERİŞİLEBİLİRLİK: her seçenek bir radyo; görünen etiket kısa, ölçüt (BR-29
 * bandı / havuz ölçütü / yön cümlesi) erişilebilir adın PARÇASI (sr-only).
 * Seçili DOLU, seçilmemiş çerçeveli (WCAG 1.4.1); görünen yön metni tam
 * cümlenin İÇİNDE (WCAG 2.5.3).
 */
function WhichMoreSetup({
  statKey,
  level,
  direction,
  question,
  onStat,
  onLevel,
  onDirection,
  onStart,
  roomEntry,
}: WhichMoreSetupProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <DataLabel className="text-accent">Meydan okuma modu</DataLabel>
        <h1 className="font-display text-4xl font-bold tracking-tight text-balance uppercase sm:text-5xl">
          Hangisi Daha
        </h1>
        <p className="max-w-prose text-muted">
          Bir istatistik seç, iki futbolcudan hangisinin önde olduğunu bul.
          Doğru bildiğin sürece seçtiğin oyuncu kalır;{" "}
          <strong className="font-semibold text-foreground">
            bir yanlış koşuyu bitirir
          </strong>
          .
        </p>
      </div>

      {/*
        ODAYA ÇAĞRI — §12.8. `h1`'in ALTINDA (kullanıcı oyunu anlamış), ama
        adımların üstünde (henüz kurmaya başlamamış); §12.7'deki sıra kararının
        Hangisi Daha karşılığı. Hesap kapalıyken sayfa bu yuvayı hiç doldurmaz.
      */}
      {roomEntry}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* ADIM 01 — METRİK */}
          <fieldset className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <DataLabel as="legend" className="text-muted">
                Adım 01 · İstatistik metriği
              </DataLabel>
              <span className="text-xs text-muted">1 seçim gerekli</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {STAT_KEYS.map((key) => {
                const one = questionFor(key);
                const isCurrent = key === statKey;
                return (
                  <label key={key} className={setupCardClass(isCurrent)}>
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
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-base font-bold tracking-wide uppercase">
                        {one.name}
                      </span>
                      {isCurrent && <CheckIcon />}
                    </span>
                    <span className="mt-1.5 block text-sm text-muted">
                      {one.hint}
                    </span>
                    {/* BR-29 bandı erişilebilir adın PARÇASI: kart göze sade
                        kalır, ölçüt ekran okuyucuda tam duyulur. */}
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

          {/* ADIM 02 — HAVUZ */}
          <fieldset className="flex flex-col gap-3">
            <DataLabel as="legend" className="text-muted">
              Adım 02 · Oyuncu havuzu derinliği
            </DataLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {LEVELS.map((option) => {
                const one = levelFor(option);
                const isCurrent = option === level;
                return (
                  <label key={option} className={setupCardClass(isCurrent)}>
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
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-base font-bold tracking-wide uppercase">
                        {one.name}
                      </span>
                      {isCurrent && <CheckIcon />}
                    </span>
                    {/* Ölçüt erişilebilir adın parçası: "Kolay" tek başına
                        neyin kolay olduğunu söylemez. */}
                    <span className="mt-1.5 block text-sm text-muted">
                      {one.detail}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* ADIM 03 — YÖN */}
          <fieldset className="flex flex-col gap-3">
            <DataLabel as="legend" className="text-muted">
              Adım 03 · Karşılaştırma yönü
            </DataLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["more", "less"] as const).map((option) => {
                const isCurrent = option === direction;
                return (
                  <label
                    key={option}
                    className={
                      "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-display text-base font-bold tracking-wide uppercase transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent " +
                      (isCurrent
                        ? "border-accent bg-accent text-accent-fg shadow-card"
                        : "border-line bg-surface text-muted hover:border-line-strong hover:text-foreground")
                    }
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
                    {/* GÖRÜNEN kısa (ok + kısa biçim tek aria-hidden sarmada),
                        DUYULAN tam (WCAG 2.5.3). */}
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center gap-1.5"
                    >
                      <DirectionArrow more={option === "more"} />
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

        {/* SORU ÖNİZLEMESİ + BAŞLA (masaüstünde sağ sütun, sabit) */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <DataLabel className="text-accent">Soru önizlemesi</DataLabel>
              <DataLabel className="text-muted">Editoryal format</DataLabel>
            </div>

            {/* SEÇİMLERİN ÇIKTISI BİR CÜMLEDİR ve burada bir bütün olarak
                görünür — düello başlamadan ne sorulacağı okunur. */}
            <p className="font-display text-2xl font-bold tracking-tight text-balance uppercase">
              Hangisi {direction === "more" ? question.more : question.less}?
            </p>

            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <DataLabel className="mb-1 text-muted">
                Parametre kapsamı
              </DataLabel>
              <p className="text-sm text-muted">
                {levelFor(level).note} · {question.hint}
              </p>
            </div>

            <p className="flex items-start gap-2 text-sm text-note">
              <CheckIcon />
              Değerler gizlidir; karar verilene kadar açığa çıkmaz.
            </p>
          </div>

          <Button size="lg" onClick={onStart}>
            Başla
          </Button>

          {/* Modun rastgele/sonsuz olduğunu (BR-32) ve lider tablosuna
              girmediğini (§11) tekrar söyler — §5.2 dürüstlük metni sınıfı. */}
          <p className="text-center text-xs font-semibold tracking-wide text-muted uppercase">
            Kayıtsız · Sıralamasız · Anlık skor koşusu
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Seçili kartın onay işareti — satır içi SVG (§7.12: ikon fontu değil). */
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-5 w-5 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

/** Yön oku — "daha çok" yukarı, "daha az" aşağı; satır içi SVG, aria-hidden. */
function DirectionArrow({ more }: { readonly more: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {more ? (
        <path d="M12 19V5M5 12l7-7 7 7" />
      ) : (
        <path d="M12 5v14M5 12l7 7 7-7" />
      )}
    </svg>
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
 * Künye kısayolları — "Ayarları değiştir" (kuruluma dön), "Nasıl oynanır"
 * çapası ve "Seriyi paylaş" (§9.3).
 *
 * `onShare` verilmezse paylaş düğmesi çıkmaz (paylaşılacak bir seri yok). Çapa
 * sayfanın altındaki bölüme iner; ikonlar satır içi SVG (§7.12: harici
 * font/glif değil, CSP `font-src 'self'`).
 */
function WhichMoreHeaderLinks({
  onOpenSetup,
  onShare,
  shareStatus,
}: {
  readonly onOpenSetup: () => void;
  readonly onShare?: () => void;
  readonly shareStatus: string | null;
}) {
  return (
    <nav
      aria-label="Hangisi daha kısayolları"
      className="flex flex-wrap items-center gap-2"
    >
      <button type="button" className={HEADER_LINK_CLASS} onClick={onOpenSetup}>
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
          <path d="M4 6h10M4 12h7M4 18h13" />
          <path d="M16 4v4M20 14v4M13 16v4" />
        </svg>
        <span>Ayarları değiştir</span>
      </button>

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
