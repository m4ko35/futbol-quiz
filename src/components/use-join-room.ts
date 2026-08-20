"use client";

import { useCallback, useState } from "react";
import { readErrorMessage, toDisplayMessage } from "@/lib/http/error-message";

/**
 * Odaya katılma — PROJECT.md §12.4, BR-54/BR-57.
 *
 * TURU BAŞLATAN ÇAĞRI BUDUR: ikinci oyuncunun katılması ile turun başlaması
 * aynı olaydır ve hedef o anda ikisine birden açılır.
 *
 * KATILMA ASLA SAYFA AÇILIŞINDA KENDİLİĞİNDEN OLMAZ. Arkadaşının gönderdiği
 * bağlantıya tıklamak, koltuğa oturmak için yeterli sayılsaydı, yanlışlıkla
 * açılan bir bağlantı odayı doldurup gerçek oyuncuyu dışarıda bırakırdı
 * (BR-54: ikinci koltuk tektir). Bu yüzden her iki giriş de — kod yazmak ve
 * bağlantıya tıklamak — açık bir düğmeye basmayı gerektiriyor.
 *
 * NEREYE GİDİLECEĞİNİ ÇAĞIRAN SÖYLER. Lobiden gelindiğinde odaya gidilmesi,
 * zaten odanın adresindeyken sayfanın tazelenmesi gerekiyor; ikisini tek bir
 * yönlendirmeyle çözmeye çalışmak, birinde sessizce hiçbir şey yapmayan bir
 * çağrı bırakırdı.
 */

export interface JoinRoomState {
  join(code: string): void;
  readonly isJoining: boolean;
  readonly failure: string | null;
}

export function useJoinRoom(onJoined: (code: string) => void): JoinRoomState {
  const [isJoining, setIsJoining] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const join = useCallback(
    (code: string): void => {
      setIsJoining(true);
      setFailure(null);

      void (async () => {
        try {
          const response = await fetch(
            `/api/oda/${encodeURIComponent(code)}/katil`,
            { method: "POST" },
          );
          /**
           * Sunucunun gerekçesi OLDUĞU GİBİ gösteriliyor ve ayrımı korumak
           * önemli: "Böyle bir oda yok" ile "Bu oda dolu" farklı şeyler.
           * İkisini tek bir mesaja indirmek, kodu yanlış yazan kişiyi kodun
           * doğru olduğuna inandırırdı (§12.4).
           */
          if (!response.ok) throw new Error(await readErrorMessage(response));

          onJoined(code);
        } catch (error: unknown) {
          setIsJoining(false);
          setFailure(
            toDisplayMessage(error, "Odaya katılınamadı. Tekrar deneyin."),
          );
        }
      })();
    },
    [onJoined],
  );

  return { join, isJoining, failure };
}
