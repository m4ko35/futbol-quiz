import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
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
    <PageShell>
      <WhichMoreQuiz />

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
