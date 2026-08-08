import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { WhichMoreQuiz } from "@/components/which-more-quiz";
import { datasets } from "@/infrastructure/db/repositories";

/**
 * "Hangisi daha" ekranı — PROJECT.md §9.3.
 *
 * Diğer üç sayfanın aksine BURADA SUNUCU VERİ HAZIRLAMAZ. Sebep BR-32: ilk
 * eşleşme de bir tur ve turun içeriği (hangi iki oyuncu) rastgeledir. Sunucu
 * bileşeninde üretilseydi HTML'e gömülür, yani sayfa kaynağında görünürdü —
 * ve bir sonraki tur yine uçtan gelirdi, yani iki ayrı yol olurdu.
 *
 * Künye yine sunucudan geliyor: veri kümesinin tarihi rastgele değil.
 */

export const metadata: Metadata = {
  title: "Hangisi Daha — Futbol Quiz",
  description:
    "Bir istatistik seçin, iki futbolcuyu karşılaştırın. Doğru bildiğiniz " +
    "sürece seri uzar.",
};

export default async function WhichMorePage() {
  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Hangisi Daha
        </h1>
        <p className="mt-3 max-w-prose text-lg text-muted">
          Bir istatistik seçin, iki futbolcudan hangisinin önde olduğunu bulun.
          Doğru bildiğiniz sürece seçtiğiniz oyuncu kalır ve karşısına yenisi
          gelir.
        </p>
      </header>

      <WhichMoreQuiz />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </main>
  );
}
