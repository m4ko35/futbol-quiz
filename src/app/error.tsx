"use client";

/**
 * Sayfa düzeyinde hata ekranı — PROJECT.md §6.3.
 *
 * Next, `error` nesnesini istemciye geçirir; ÜRETİMDE mesajı sabit bir metne
 * indirir ama biz yine de göstermiyoruz. Gerekçe: geliştirmede gerçek mesaj
 * gelir ve ekran görüntüsü paylaşıldığında yığın izi sızabilir. Kullanıcıya
 * yalnızca `digest` gösterilir — sunucu logundaki kaydın karşılığıdır.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">
        Bir şeyler ters gitti
      </h1>

      <p className="text-muted">
        İstek işlenirken beklenmeyen bir hata oluştu. Sayfayı yeniden
        deneyebilirsiniz.
      </p>

      {error.digest !== undefined && (
        // Kimlik `muted` tonunda: destek için OKUNUP YAZILACAK bir metin,
        // okunaksız olması tam da işlevini bozar. Ölçüm §7.12'de — 5,78:1
        // (açık) / 7,57:1 (koyu), AA'nın 4,5 eşiğinin üstünde.
        <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted">
          Hata kimliği: <code className="font-mono">{error.digest}</code>
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Yeniden dene
        </button>
      </div>
    </main>
  );
}
