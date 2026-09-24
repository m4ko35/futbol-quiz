"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { readErrorMessage, toDisplayMessage } from "@/lib/http/error-message";

/**
 * Oda kurup içine girme — PROJECT.md §12.4, §12.8.
 *
 * NEDEN PAYLAŞILAN BİR KANCA. Aynı eylem iki yerden başlatılıyor: lobideki
 * "Oda kur" düğmesi ve biten maçın altındaki "Yeni oda" (rövanş). İkincisi
 * lobiye bir bağlantı da olabilirdi ama rövanş, oyunun en sıcak anı — araya
 * fazladan bir sayfa koymak onu soğutur.
 *
 * GÖVDE MODA GÖRE (§12.8/§12.9, BR-67/BR-71). Argümansız çağrı İstatistik odası
 * kurar (geriye dönük, hedefi sunucu seçer — BR-56). Hangisi Daha ya da Izgara
 * gövdesi verilirse o mod kurulur; tohum yine SUNUCUDA üretilir (BR-68/BR-71).
 */

/** Hangisi Daha odası kurulum gövdesi — tohumsuz, kullanıcının seçtikleri. */
export interface WhichMoreCreateBody {
  readonly mode: "hangisi-daha";
  readonly submode: "ani-olum" | "sabit-n";
  readonly statKey: string;
  readonly level: string;
  readonly direction: string;
  /** Yalnızca Sabit N'de. */
  readonly n?: number;
}

/** Izgara (XOX) odası kurulum gövdesi — §12.9. Ayar YOK (3×3 sabit). */
export interface GridCreateBody {
  readonly mode: "izgara";
}

/** Bir oda kurma gövdesi — argümansız çağrı İstatistik (geriye dönük). */
export type CreateRoomBody = WhichMoreCreateBody | GridCreateBody;

export interface CreateRoomState {
  create(body?: CreateRoomBody): void;
  readonly isCreating: boolean;
  readonly failure: string | null;
}

export function useCreateRoom(): CreateRoomState {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const create = useCallback(
    (body?: CreateRoomBody) => {
      setIsCreating(true);
      setFailure(null);

      void (async () => {
        try {
          const response = await fetch(
            "/api/oda",
            body === undefined
              ? { method: "POST" }
              : {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                },
          );
          if (!response.ok) throw new Error(await readErrorMessage(response));

          // İki modun DTO'su da `code` taşır; yönlendirme için o yeterli.
          const json = (await response.json()) as {
            data: { readonly code: string };
          };

          /**
           * `push` DEĞİL `replace` DEĞİL — `push` doğru: kullanıcı geri tuşuyla
           * lobiye dönebilmeli. Ama bekleme durumu KALDIRILMIYOR: yönlendirme
           * tamamlanana kadar düğme kapalı kalsın diye. Aksi hâlde iki kez
           * basılabilir ve ikinci istek birinciyi silerdi (BR-60).
           */
          router.push(`/oda/${json.data.code}`);
        } catch (error: unknown) {
          setIsCreating(false);
          setFailure(
            toDisplayMessage(error, "Oda kurulamadı. Tekrar deneyin."),
          );
        }
      })();
    },
    [router],
  );

  return { create, isCreating, failure };
}
