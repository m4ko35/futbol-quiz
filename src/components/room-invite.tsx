"use client";

import Link from "next/link";
import { useEffect } from "react";
import { rememberInvite } from "@/lib/room-invite";

/**
 * Giriş yapmamış davetlinin gördüğü ekran — PROJECT.md §12.
 *
 * NEDEN YÖNLENDİRME DEĞİL. `/giris`'e doğrudan atmak, kullanıcıya neye
 * davet edildiğini hiç göstermeden hesap istemek olurdu — üstelik oda kodunu
 * da ekranda görmeden. Burada önce çağrı görünüyor, karar sonra veriliyor
 * (§11.1: giriş duvar değil).
 *
 * KOD SEKMEYE YAZILIYOR. Google akışı girişten sonra `/istatistik`'e bırakır;
 * lobi kodu oradan geri alıp hazır sunuyor (`room-invite.ts`).
 */

export function RoomInvite({ code }: { readonly code: string }) {
  useEffect(() => {
    rememberInvite(code);
  }, [code]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Bir odaya davet edildin
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Arkadaşın seninle bir istatistik maçı oynamak istiyor. İkiniz de aynı
          futbolcuyu alırsınız; daha yüksek puanı toplayan kazanır.
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

        <p className="text-sm text-muted">
          Odalar hesapla oynanıyor: sonuç ekranında karşılıklı adlar görünüyor.
        </p>

        <Link
          href="/giris"
          className="w-fit rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Giriş yap ve katıl
        </Link>
      </section>

      {/*
        SÖZ VERİLEN ŞEY YAZILI. Kullanıcı girişten sonra buraya değil
        `/istatistik`'e düşüyor; kodun kaybolmayacağını önceden söylemek, o
        anda "kayboldu" sanmasını önlüyor.
      */}
      <p className="text-sm text-muted">
        Girişten sonra bu kod hazır bekliyor olacak — tek yapman gereken{" "}
        <strong className="text-foreground">Katıl</strong>&apos;a basmak.
      </p>
    </div>
  );
}
