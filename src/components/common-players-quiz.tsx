"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClubDto } from "@/application/dto/club-dto";
import type { CommonPlayersResultDto } from "@/application/dto/common-players-dto";
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

export function CommonPlayersQuiz({ initialClubs }: CommonPlayersQuizProps) {
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
    async (term: string, signal: AbortSignal): Promise<ClubDto[]> => {
      const query = term.trim() === "" ? "" : `?q=${encodeURIComponent(term)}`;
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
      <div className="grid gap-4 sm:grid-cols-2">
        <ClubPicker
          label="Birinci kulüp"
          selected={clubA}
          onSelect={setClubA}
          excludeId={clubB?.id}
          initialOptions={initialClubs}
          search={searchClubs}
        />
        <ClubPicker
          label="İkinci kulüp"
          selected={clubB}
          onSelect={setClubB}
          excludeId={clubA?.id}
          initialOptions={initialClubs}
          search={searchClubs}
        />
      </div>

      {/* Durum bölgesi. `aria-live` ile ekran okuyucu, sonuç geldiğinde
          kullanıcıyı bilgilendirir — görsel değişimi göremeyen kullanıcı
          aksi hâlde bir şey olduğunu anlamaz. */}
      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "idle" && (
          <p className="text-sm opacity-60">
            Karşılaştırmayı başlatmak için iki kulüp seçin.
          </p>
        )}

        {state.status === "loading" && (
          <p className="text-sm opacity-60">Ortak oyuncular aranıyor…</p>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-md border border-current/25 px-4 py-3 text-sm"
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
