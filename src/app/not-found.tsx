import Link from "next/link";

/**
 * 404 ekranı — PROJECT.md §7.11.
 *
 * Next'in varsayılanı İngilizcedir ve bu sitenin arayüzü Türkçe (§1.2).
 * Kullanıcıya dilini değiştiren bir sayfa göstermek, hatayı olduğundan daha
 * ciddi gösterir.
 *
 * Sayfa hiçbir ayrıntı sızdırmaz: hangi adresin denendiği yazılmaz (§6.3).
 * Adresi yansıtmak, kullanıcı girdisini sayfaya basmanın en kolay yolu ve
 * bunun için hiçbir sebep yok.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-6 py-16">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>

      <p className="opacity-70">
        Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
      </p>

      <div>
        <Link
          href="/"
          className="inline-block rounded-md border border-current/50 px-4 py-2 text-sm font-medium hover:bg-current/10 focus:ring-2 focus:ring-current/60 focus:outline-none"
        >
          Başa dön
        </Link>
      </div>
    </main>
  );
}
