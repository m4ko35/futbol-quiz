/**
 * Geçici karşılama ekranı.
 *
 * Gerçek kulüp seçimi ve sonuç listesi Faz 3'te bu sayfanın yerini alacak
 * (PROJECT.md §10). Şu an burada yalnızca iskeletin ayakta olduğunu gösteren
 * metin var — iş mantığı veya veri erişimi yok.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Futbol Quiz</h1>
        <p className="mt-2 text-lg opacity-70">
          İki kulüp seçin, ikisinde de forma giymiş oyuncuları görün.
        </p>
      </div>

      <section className="rounded-lg border border-current/15 p-5">
        <h2 className="text-sm font-medium tracking-wide uppercase">
          Kurulum durumu
        </h2>
        <p className="mt-3 text-sm leading-relaxed opacity-70">
          Faz 0 tamamlandı: proje iskeleti, katmanlı klasör yapısı, güvenlik
          başlıkları ve test altyapısı hazır. Sıradaki adım Faz 1 — veri modeli
          ve Wikidata ETL süreci.
        </p>
        <p className="mt-3 text-sm opacity-50">
          Ayrıntılar için depodaki <code className="font-mono">PROJECT.md</code>{" "}
          dosyasına bakın.
        </p>
      </section>
    </main>
  );
}
