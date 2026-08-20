"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { RoomDto } from "@/application/use-cases/rooms";
import { readErrorMessage, toDisplayMessage } from "@/lib/http/error-message";

/**
 * Oda kurup içine girme — PROJECT.md §12.4.
 *
 * NEDEN PAYLAŞILAN BİR KANCA. Aynı eylem iki yerden başlatılıyor: lobideki
 * "Oda kur" düğmesi ve biten maçın altındaki "Yeni oda" (rövanş). İkincisi
 * lobiye bir bağlantı da olabilirdi ama rövanş, oyunun en sıcak anı — araya
 * fazladan bir sayfa koymak onu soğutur.
 *
 * GÖVDE YOK ve bu BR-56'nın kendisi: hedefi sunucu seçiyor.
 */

export interface CreateRoomState {
  create(): void;
  readonly isCreating: boolean;
  readonly failure: string | null;
}

export function useCreateRoom(): CreateRoomState {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const create = useCallback(() => {
    setIsCreating(true);
    setFailure(null);

    void (async () => {
      try {
        const response = await fetch("/api/oda", { method: "POST" });
        if (!response.ok) throw new Error(await readErrorMessage(response));

        const body = (await response.json()) as { data: RoomDto };

        /**
         * `push` DEĞİL `replace` DEĞİL — `push` doğru: kullanıcı geri tuşuyla
         * lobiye dönebilmeli. Ama bekleme durumu KALDIRILMIYOR: yönlendirme
         * tamamlanana kadar düğme kapalı kalsın diye. Aksi hâlde iki kez
         * basılabilir ve ikinci istek birinciyi silerdi (BR-60: yeni oda
         * kuran, kendi eski odalarını sildiriyor).
         */
        router.push(`/oda/${body.data.code}`);
      } catch (error: unknown) {
        setIsCreating(false);
        setFailure(toDisplayMessage(error, "Oda kurulamadı. Tekrar deneyin."));
      }
    })();
  }, [router]);

  return { create, isCreating, failure };
}
