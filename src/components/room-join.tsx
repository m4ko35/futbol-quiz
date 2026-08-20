"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useJoinRoom } from "./use-join-room";

/**
 * Paylaşılan bağlantıyla gelen kişinin katılma ekranı — PROJECT.md §12.4.
 *
 * NEDEN AYRI BİR EKRAN VAR. Arkadaşına kodu söylemek yerine bağlantıyı
 * gönderen kullanıcı, karşı tarafı doğrudan `/oda/{kod}` adresine düşürüyor.
 * O kişi odanın üyesi değil, yani `getRoom` onu reddediyor. Boş bir hata
 * ekranı göstermek yerine, gelmek istediği yere GİRMESİNİ sağlayan bir düğme
 * gösteriliyor.
 *
 * DÜĞMEYE BASMAK ŞART: sayfa açılır açılmaz katılmak, yanlışlıkla tıklanan
 * bir bağlantının odayı doldurup gerçek oyuncuyu dışarıda bırakması demekti
 * (BR-54). Ayrıca GET bir isteğin yan etkisi olmamalı.
 */

export function RoomJoin({ code }: { readonly code: string }) {
  const router = useRouter();

  /**
   * Zaten odanın adresindeyiz: yönlendirme değil TAZELEME gerekiyor. Sunucu
   * bileşeni yeniden çalışıp bu kez `uye` sonucunu okuyacak ve oda tahtası
   * çizilecek.
   */
  const onJoined = useCallback(() => {
    router.refresh();
  }, [router]);

  const { join, isJoining, failure } = useJoinRoom(onJoined);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Odaya katıl
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Bir arkadaşın seni bu odaya çağırdı. Katıldığın anda tur ikiniz için
          birden başlar ve aynı futbolcu ikinize açılır.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-accent bg-accent-soft p-5 shadow-card">
        <div className="flex flex-col gap-1">
          <p className="text-[0.65rem] font-extrabold tracking-[0.13em] text-muted uppercase">
            Oda kodu
          </p>
          <p className="font-mono text-4xl font-bold tracking-[0.2em] text-accent sm:text-5xl">
            {code}
          </p>
        </div>

        <button
          type="button"
          disabled={isJoining}
          className="w-fit rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            join(code);
          }}
        >
          {isJoining ? "Katılınıyor…" : "Bu odaya katıl"}
        </button>
      </section>

      {failure !== null && (
        <p
          role="alert"
          className="rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
        >
          {failure}
        </p>
      )}

      <p className="text-sm text-muted">
        Yanlış odaya mı geldin?{" "}
        <Link
          href="/oda"
          className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Başka bir kod gir
        </Link>
        .
      </p>
    </div>
  );
}
