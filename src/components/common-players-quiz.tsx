"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClubDto } from "@/application/dto/club-dto";
import type { CommonPlayersResultDto } from "@/application/dto/common-players-dto";
import type { LeagueSummary } from "@/application/ports/club-repository";
import type { PopularPair } from "@/application/use-cases/popular-pairs";
import { MAX_CLUB_RESULTS } from "@/application/use-cases/search-clubs";
import { readErrorMessage } from "@/lib/http/error-message";
import { ClubPicker } from "./club-picker";
import { CommonPlayersResult } from "./common-players-result";
import { DataLabel } from "./data-label";
import { ModeHeader, Scoreboard } from "./mode-header";

/**
 * Ekranın durum makinesi — iki kulüp seç, ortak oyuncuları getir.
 *
 * Bu bileşen iş kuralı BARINDIRMAZ; kurallar sunucuda uygulanır. Buradaki tek
 * "kural" görünümü, aynı kulübün iki kez seçilememesi için ikinci listeden
 * birincinin çıkarılmasıdır — o da bir kural uygulaması değil, kullanıcıyı
 * kesin reddedilecek bir seçimden koruma (BR-4 yine sunucuda denetlenir).
 */

interface FetchState {
  readonly status: "idle" | "loading" | "success" | "error";
  readonly result?: CommonPlayersResultDto;
  readonly message?: string;
}

/**
 * Tamamlanmış bir istek ve ait olduğu seçim.
 *
 * `pairKey` neden saklanıyor: görünen durum bundan TÜRETİLİR. Kullanıcı
 * kulüplerden birini değiştirdiğinde anahtar hemen değişir ve elimizdeki
 * sonuç otomatik olarak geçersiz sayılır — "yükleniyor" ayrı bir state
 * güncellemesi gerektirmez.
 *
 * Alternatifi, efekt içinde senkron `setState({status:"loading"})` çağırmaktı;
 * o hem art arda render tetikler hem de iki güncelleme arasında ESKİ sonucun
 * yeni seçime aitmiş gibi görünmesine yol açardı.
 */
interface CompletedRequest {
  readonly pairKey: string;
  readonly state: FetchState;
}

const IDLE: FetchState = { status: "idle" };
const LOADING: FetchState = { status: "loading" };

export interface CommonPlayersQuizProps {
  readonly initialClubs: readonly ClubDto[];
  /** BR-37 — gözatılabilir ligler; sunucuda hazırlanır (§6.1). */
  readonly leagues: readonly LeagueSummary[];
  /** Seçilebilir kulüp sayısı — künye tabelası ve kapsam bildirimi (§7.15). */
  readonly clubCount: number;
  /** Veri kümesindeki oyuncu sayısı — künye tabelası. */
  readonly playerCount: number;
  /** Hazır seçim çipleri — sunucuda QID'den çözülmüş küratörlü çiftler. */
  readonly popularPairs: readonly PopularPair[];
}

/**
 * Listedeki dönem kaydı sayısı.
 *
 * Tabeladaki ikinci hücre. Oyuncu sayısı "kaç kişi", dönem sayısı "kaç kayıt"
 * demek ve ikisi ayrışıyor: bir oyuncu iki kulüpte de birden çok kez oynamış
 * olabilir. Sunucudan ayrıca istenmiyor — elimizdeki DTO'dan sayılıyor.
 */
function countSpells(result: CommonPlayersResultDto): number {
  return result.players.reduce(
    (sum, player) => sum + player.spellsAtA.length + player.spellsAtB.length,
    0,
  );
}

export function CommonPlayersQuiz({
  initialClubs,
  leagues,
  clubCount,
  playerCount,
  popularPairs,
}: CommonPlayersQuizProps) {
  const [clubA, setClubA] = useState<ClubDto | null>(null);
  const [clubB, setClubB] = useState<ClubDto | null>(null);
  const [completed, setCompleted] = useState<CompletedRequest | null>(null);

  const pairKey =
    clubA === null || clubB === null ? null : `${clubA.id}|${clubB.id}`;

  // Görünen durum türetilir, saklanmaz.
  const state: FetchState =
    pairKey === null
      ? IDLE
      : completed?.pairKey === pairKey
        ? completed.state
        : LOADING;

  const searchClubs = useCallback(
    async (
      term: string,
      leagueWikidataId: string | null,
      signal: AbortSignal,
    ): Promise<ClubDto[]> => {
      const params = new URLSearchParams();
      if (term.trim() !== "") params.set("q", term);
      if (leagueWikidataId !== null) {
        params.set("league", leagueWikidataId);
        /**
         * Lig gözatılırken izin verilen EN YÜKSEK sayı istenir — BR-37.
         *
         * Üst sınır (50) DEĞİŞMİYOR; değişen, varsayılanın (20) bu bağlamda
         * yanlış olması: kullanıcı "Serie A"ya tıklayınca ligi görmek ister,
         * ligin dörtte birini değil. Sorgu tek lige daraldığı için maliyet de
         * genel aramadan düşük.
         */
        params.set("limit", String(MAX_CLUB_RESULTS));
      }

      const query = params.size === 0 ? "" : `?${params.toString()}`;
      const response = await fetch(`/api/clubs${query}`, { signal });

      if (!response.ok)
        throw new Error(
          await readErrorMessage(
            response,
            "Sonuçlar alınamadı. Lütfen tekrar deneyin.",
          ),
        );

      const body = (await response.json()) as { data: ClubDto[] };
      return body.data;
    },
    [],
  );

  useEffect(() => {
    if (clubA === null || clubB === null || pairKey === null) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ clubA: clubA.id, clubB: clubB.id });

    fetch(`/api/common-players?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setCompleted({
            pairKey,
            state: {
              status: "error",
              message: await readErrorMessage(
                response,
                "Sonuçlar alınamadı. Lütfen tekrar deneyin.",
              ),
            },
          });
          return;
        }
        const body = (await response.json()) as {
          data: CommonPlayersResultDto;
        };
        setCompleted({
          pairKey,
          state: { status: "success", result: body.data },
        });
      })
      .catch((error: unknown) => {
        // Seçim değişince önceki istek iptal edilir; bu bir hata değil.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setCompleted({
          pairKey,
          state: {
            status: "error",
            message: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.",
          },
        });
      });

    return () => {
      controller.abort();
    };
  }, [clubA, clubB, pairKey]);

  /*
    TABELA YALNIZCA SONUÇTA — §7.15.

    Veri kümesinin büyüklüğü artık üstteki "Veri kümesi" şeridinde (aşağıda);
    aynı üç sayıyı boş durumda tabelada da göstermek, aynı sayıyı iki yerde
    yaşatmak olurdu (§7.15 bunu açıkça reddediyor). Bu yüzden boş durumda tabela
    BASILMAZ; yalnızca sonuç geldiğinde belirir ve VURGULANIR (`lit`) — bugünkü
    arayüzün en çok eleştirilen yanı sonucun sessizce belirmesiydi.
  */
  const found = state.status === "success" ? state.result : undefined;
  const scoreboard =
    found === undefined ? undefined : (
      <Scoreboard
        label="Sonuç"
        lit={found.count > 0}
        cells={[
          {
            label: "Ortak oyuncu",
            value: found.count.toLocaleString("tr-TR"),
            tone: found.count > 0 ? "accent" : undefined,
          },
          {
            label: "Dönem",
            value: countSpells(found).toLocaleString("tr-TR"),
          },
        ]}
      />
    );

  return (
    <div className="flex flex-col gap-8">
      <ModeHeader
        title="Ortak Oyuncu"
        task={
          <>
            İki kulüp seç;{" "}
            <strong className="font-semibold">ikisinde de</strong> forma giymiş
            oyuncuları gör.
          </>
        }
        scoreboard={scoreboard}
      />

      {/*
        VERİ KÜMESİ ŞERİDİ — §7.15 "Kapsam bandı → veri kümesi şeridi".

        Kapsamın büyüklüğünü üç sayıda söyler; sayılar VERİDEN geliyor (elle
        yazılan bir kapsam sayısı §5.2'de bir kez sessizce yalan söylemişti:
        "345 kulüp"). Bu şerit ortak oyuncu modunda dataset ölçeğinin TEK yeri
        (tabela sonuca ayrıldı — aynı sayı iki yerde yaşamıyor).

        "CANLI" DEĞİL "VERİ KÜMESİ": veri periyodik bir ETL anlık görüntüsü
        (altbilgideki "son güncelleme"); "canlı" demek gerçek zamanlılık iddia
        eder ve o tarihle çelişirdi (§5.2). Nokta da nabız atmaz.

        Eski ülke çip bulutu KALDIRILDI: "hangi ülkeler" bilgisi seçicinin lig
        gözatında (BR-37) ve boş sonuç metninde zaten duruyor; her zaman görünen
        bir bulut aynı şeyi ikinci kez, daha ağır taşıyordu.
      */}
      <section
        aria-label="Veri kümesi"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3"
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full bg-accent"
          />
          <DataLabel className="text-muted">Veri kümesi</DataLabel>
        </span>
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>
            <strong className="font-semibold tabular-nums text-foreground">
              {leagues.length.toLocaleString("tr-TR")}
            </strong>{" "}
            lig
          </span>
          <span aria-hidden="true" className="text-line-strong">
            •
          </span>
          <span>
            <strong className="font-semibold tabular-nums text-foreground">
              {clubCount.toLocaleString("tr-TR")}
            </strong>{" "}
            kulüp
          </span>
          <span aria-hidden="true" className="text-line-strong">
            •
          </span>
          <span>
            <strong className="font-semibold tabular-nums text-foreground">
              {playerCount.toLocaleString("tr-TR")}
            </strong>{" "}
            futbolcu
          </span>
        </span>
      </section>

      {/* İki seçici arasındaki "∩", sorunun ne olduğunu bir bakışta söyler:
          birleşim değil KESİŞİM. Yalnızca geniş ekranda görünür; dar ekranda
          seçiciler alt alta gelince aradaki işaret anlamını yitirirdi. */}
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <ClubPicker
          label="Birinci kulüp"
          selected={clubA}
          onSelect={setClubA}
          excludeId={clubB?.id}
          initialOptions={initialClubs}
          leagues={leagues}
          search={searchClubs}
        />
        {/* KESİŞİM DÜĞÜMÜ — sorunun ne olduğunu bir bakışta söyler: birleşim
            değil KESİŞİM. Etiket seçicilerin etiketiyle, kutu da girdileriyle
            hizalanır (ikisi de label + öğe yığını). Yalnızca geniş ekranda;
            dar ekranda seçiciler alt alta gelince aradaki işaret anlamını
            yitirirdi. */}
        <div
          aria-hidden="true"
          className="hidden flex-col items-center gap-2 sm:flex"
        >
          <DataLabel className="text-muted">Kesişim</DataLabel>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-accent bg-accent-soft text-2xl font-bold text-accent">
            ∩
          </span>
        </div>
        <ClubPicker
          label="İkinci kulüp"
          selected={clubB}
          onSelect={setClubB}
          excludeId={clubA?.id}
          initialOptions={initialClubs}
          leagues={leagues}
          search={searchClubs}
        />
      </div>

      {/*
        POPÜLER KARŞILAŞTIRMALAR — hazır seçim çipleri (§9.2 ile aynı ruh:
        tanınırlık bir ürün kararı). Tek tıkla iki kulübü birden doldurur;
        boş ekranda "ne yazsam" tereddüdünü kaldırır. Çiftler sunucuda QID'den
        çözülür (getPopularPairs); etiket kulübün GERÇEK kısa adıdır.

        Etkin çip iki yönlü eşleşir: kullanıcı kulüpleri elle ters sırada da
        seçebilir, kesişim simetriktir. Boş liste (bir kulüp çözülemezse)
        bölümü hiç basmaz.
      */}
      {popularPairs.length > 0 && (
        <section
          aria-label="Popüler karşılaştırmalar"
          className="-mt-3 flex flex-col gap-2.5"
        >
          <DataLabel className="text-muted">Popüler karşılaştırmalar</DataLabel>
          <div className="flex flex-wrap gap-2">
            {popularPairs.map((pair) => {
              const active =
                (clubA?.id === pair.a.id && clubB?.id === pair.b.id) ||
                (clubA?.id === pair.b.id && clubB?.id === pair.a.id);
              return (
                <button
                  key={`${pair.a.id}|${pair.b.id}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setClubA(pair.a);
                    setClubB(pair.b);
                  }}
                  className={
                    "rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
                    (active
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-line bg-surface text-muted hover:border-line-strong hover:text-foreground")
                  }
                >
                  {/* METİN-ÖNCELİKLİ (Stitch çipleri gibi): arma yok. "×" görsel
                      ayraç, aria-hidden — erişilebilir ad iki kulübün adıdır.
                      Ad KIRPILMAZ; "Internazionale Milano" gibi uzun kısa adlar
                      artık tam okunur. */}
                  {pair.a.shortName}
                  <span aria-hidden="true" className="mx-1.5 opacity-60">
                    ×
                  </span>
                  {pair.b.shortName}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Durum bölgesi. `aria-live` ile ekran okuyucu, sonuç geldiğinde
          kullanıcıyı bilgilendirir — görsel değişimi göremeyen kullanıcı
          aksi hâlde bir şey olduğunu anlamaz. */}
      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "idle" && (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
            {/* İki kesişen çember — SVG değil, iki `div`. Marka işaretiyle
                aynı fikir ama kendi `clipPath` kimliğini taşımadığı için
                sayfada ikinci kez çizilmesi kimlik çakışması üretmiyor. */}
            <span
              aria-hidden="true"
              className="mx-auto flex w-fit items-center"
            >
              <span className="h-10 w-10 rounded-full border-2 border-line-strong" />
              <span className="-ml-4 h-10 w-10 rounded-full border-2 border-line-strong" />
            </span>
            <p className="mt-4 text-sm text-muted">
              Karşılaştırmayı başlatmak için iki kulüp seçin.
            </p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <p className="text-sm text-muted">Ortak oyuncular aranıyor…</p>
            {/* İskelet satırlar: beklemenin NE KADAR süreceğini değil, neyin
                geleceğini gösterir. Tek satırlık "aranıyor" metni, sonuç
                gelince sayfanın boyunu birden değiştiriyordu. */}
            <div aria-hidden="true" className="mt-4 flex flex-col gap-3">
              <span className="h-4 w-1/3 animate-pulse rounded bg-line" />
              <span className="h-4 w-2/3 animate-pulse rounded bg-line" />
              <span className="h-4 w-1/2 animate-pulse rounded bg-line" />
            </div>
          </div>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
          >
            {state.message}
          </p>
        )}

        {state.status === "success" && state.result !== undefined && (
          <CommonPlayersResult result={state.result} />
        )}
      </div>
    </div>
  );
}
