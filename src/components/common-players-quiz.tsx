"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClubDto } from "@/application/dto/club-dto";
import type { CommonPlayersResultDto } from "@/application/dto/common-players-dto";
import type { LeagueSummary } from "@/application/ports/club-repository";
import { MAX_CLUB_RESULTS } from "@/application/use-cases/search-clubs";
import { ClubPicker } from "./club-picker";
import { CommonPlayersResult } from "./common-players-result";

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
}

/** API hata gövdesinden kullanıcıya gösterilebilir mesajı çıkarır (§6.3). */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "object"
    ) {
      const error = (body as { error: { message?: unknown } }).error;
      if (typeof error.message === "string") return error.message;
    }
  } catch {
    // Gövde JSON değilse aşağıdaki genel mesaja düşülür.
  }
  return "Sonuçlar alınamadı. Lütfen tekrar deneyin.";
}

export function CommonPlayersQuiz({
  initialClubs,
  leagues,
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

      if (!response.ok) throw new Error(await readErrorMessage(response));

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
              message: await readErrorMessage(response),
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

  return (
    <div className="flex flex-col gap-8">
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
        <span
          aria-hidden="true"
          className="hidden pb-2.5 text-xl font-semibold text-muted sm:block"
        >
          ∩
        </span>
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
