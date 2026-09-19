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
  title: "Hangisi Daha — Futbol Challenge",
  alternates: { canonical: "/hangisi-daha" },
  description:
    "İki futbolcuyu karşılaştır: hangisi daha çok gol, maç veya millî maç " +
    "yaptı? Doğru bildikçe serin uzar. Ücretsiz Türkçe futbol tahmin oyunu.",
};

export default async function WhichMorePage() {
  const dataGeneratedAt = await datasets.getGeneratedAt();

  return (
    <PageShell>
      <WhichMoreQuiz />

      {/* SEO/tanıtım bölümü — §7.11. Oyunun altında, ikincil tonda. */}
      <section className="flex flex-col gap-3 border-t border-line pt-8">
        <h2 className="text-lg font-semibold">
          &quot;Hangisi daha&quot; nasıl oynanır?
        </h2>
        <p className="max-w-prose text-sm text-muted">
          Bir istatistik seçin (gol, maç, kulüp sayısı…) ve karşınıza gelen iki
          futbolcudan hangisinin o alanda daha yüksek olduğunu tahmin edin. İki
          futbolcuyu karşılaştırıp doğru olanı seçin.
        </p>
        <p className="max-w-prose text-sm text-muted">
          Doğru bildikçe seriniz uzar; bir yanlış seriyi sıfırlar. Ücretsiz bir
          futbol tahmin oyunu, hesap gerekmez.
        </p>
      </section>

      <SiteFooter dataGeneratedAt={dataGeneratedAt} />
    </PageShell>
  );
}
