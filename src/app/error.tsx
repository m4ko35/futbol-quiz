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
      <h1 className="text-2xl font-semibold">Bir şeyler ters gitti</h1>

      <p className="opacity-70">
        İstek işlenirken beklenmeyen bir hata oluştu. Sayfayı yeniden
        deneyebilirsiniz.
      </p>

      {error.digest !== undefined && (
        <p className="text-sm opacity-50">
          Hata kimliği: <code className="font-mono">{error.digest}</code>
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-current/25 px-4 py-2 text-sm font-medium hover:bg-current/5 focus:ring-2 focus:ring-current/30 focus:outline-none"
        >
          Yeniden dene
        </button>
      </div>
    </main>
  );
}
