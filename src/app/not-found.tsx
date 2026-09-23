import Link from "next/link";
import { DataLabel } from "@/components/data-label";
import { buttonClasses } from "@/components/ui/button";

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
      {/* Editorial çapa: hata kodu kicker'da (§7.12). Adres YAZILMAZ (§6.3);
          "404" bir kullanıcı girdisi değil, sabit durum kodu. */}
      <div className="flex flex-col gap-1">
        <DataLabel as="p" className="text-accent">
          404 · Sayfa yok
        </DataLabel>
        <h1 className="text-3xl font-bold tracking-tight">Sayfa bulunamadı</h1>
      </div>

      <p className="text-muted">
        Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
      </p>

      <div>
        <Link href="/" className={buttonClasses({ size: "md" })}>
          Başa dön
        </Link>
      </div>
    </main>
  );
}
