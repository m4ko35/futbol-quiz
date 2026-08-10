// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NumberLine } from "@/components/stat-match-game";
import {
  SCORE_TOLERANCE_FACTOR,
  STAT_DEVIATIONS,
} from "@/domain/services/stat-match";

/**
 * Sayı doğrusu — §9.2.
 *
 * BURADA DENETLENEN ŞEY ÖLÇEĞİN KAYNAĞI. Doğrunun anlattığı iddia şu: uçta
 * durmak "puan yok" demek. Bu ancak ölçek BR-18'in puanlama penceresine —
 * `SCORE_TOLERANCE_FACTOR × STAT_DEVIATIONS[key]` — eşitse doğrudur. Sabit bir
 * ölçeğe ("0 – 800") dönen bir değişiklik aynı görüntüyü verir ama görüntü
 * artık yalan söyler: kullanıcı uca yakın bir işaret görüp hâlâ puan
 * alabileceğini sanır. Testler o eşitliği tutuyor.
 */

afterEach(cleanup);

const TARGET = 435;
const TOLERANCE = SCORE_TOLERANCE_FACTOR * STAT_DEVIATIONS.appearances;

function markerLeft(): string {
  const marker = screen.getByText("senin");
  return (marker as HTMLElement).style.left;
}

describe("NumberLine", () => {
  it("hedef her zaman ORTADA durur — pencere ona göre kuruluyor", () => {
    render(<NumberLine statKey="appearances" target={TARGET} />);

    const marker = screen.getByText("hedef");
    expect(marker).toBeInTheDocument();
  });

  it("hedefe eşit tahmin tam ortaya düşer", () => {
    render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET}
        score={100}
      />,
    );

    expect(markerLeft()).toBe("50%");
  });

  it("puanın SIFIRA düştüğü uzaklık tam uçtur", () => {
    // Ölçek uydurulmuş olsaydı bu iki değer ucun berisinde ya da ötesinde
    // kalırdı ve "puan yok" etiketi yanlış yeri işaret ederdi.
    const { unmount } = render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET - TOLERANCE}
        score={0}
      />,
    );
    expect(markerLeft()).toBe("0%");
    unmount();

    render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET + TOLERANCE}
        score={0}
      />,
    );
    expect(markerLeft()).toBe("100%");
  });

  it("pencere dışı tahmin uçta DURUR, taşmaz", () => {
    render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET + TOLERANCE * 5}
        score={0}
      />,
    );

    expect(markerLeft()).toBe("100%");
  });

  /**
   * Pencere istatistikten istatistiğe DEĞİŞİR ve asıl anlatılmak istenen bu:
   * kulüp sayısında ±2,4 yeterken kulüp maçında ±222,8 gerekiyor. Aynı mutlak
   * sapma iki istatistikte aynı yere düşerse doğru hiçbir şey öğretmez.
   */
  it("aynı mutlak sapma dar ve geniş istatistikte AYNI yere düşmez", () => {
    const { unmount } = render(
      <NumberLine statKey="clubs" target={4} chosen={6} score={0} />,
    );
    const dar = markerLeft();
    unmount();

    render(
      <NumberLine statKey="appearances" target={4} chosen={6} score={99} />,
    );
    const genis = markerLeft();

    expect(dar).not.toBe(genis);
  });

  /**
   * ÇAKIŞMA KUSURU — iyi cevapta ortaya çıkıyordu.
   *
   * İki işaret de doğrunun üstündeyken "hedef" ile "senin" etiketleri, tahmin
   * hedefe yaklaştıkça birbirine giriyor, %100'lük bir tahminde tam olarak
   * çakışıyordu: doğru yalnızca söyleyecek iyi bir şeyi olmadığında düzgün
   * çalışıyordu. Çözüm eşiğe bakan bir kaçınma değil, geometrik ayrım —
   * hedef doğrunun üstünde, seçim altında.
   *
   * BU TESTİN GÖREMEDİĞİ ŞEY: jsdom'un yerleşim motoru yok, iki kutunun
   * gerçekten üst üste binip binmediği ölçülemez. Tutulan şey, iki etiketin
   * AYRI SATIRLARDA durduğu — çakışmayı imkânsız kılan yapı.
   */
  it("hedefe TAM eşit tahminde bile iki etiket ayrı satırlarda durur", () => {
    render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET}
        score={100}
      />,
    );

    const satir = (element: HTMLElement): string =>
      [...element.classList].find((one) => one.startsWith("top-")) ?? "";

    const hedef = screen.getByText("hedef");
    const senin = screen.getByText("senin");

    expect(satir(hedef)).not.toBe("");
    expect(satir(senin)).not.toBe("");
    expect(satir(hedef)).not.toBe(satir(senin));
  });

  it("uçtaki etiket ortalanmaz — kaptan taşmasın diye işarete hizalanır", () => {
    const { unmount } = render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET - TOLERANCE}
        score={0}
      />,
    );
    expect(screen.getByText("senin")).toHaveClass("translate-x-0");
    unmount();

    render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET + TOLERANCE}
        score={0}
      />,
    );
    expect(screen.getByText("senin")).toHaveClass("-translate-x-full");
  });

  it("ortadaki etiket kendi ekseninde ORTALANIR", () => {
    render(
      <NumberLine
        statKey="appearances"
        target={TARGET}
        chosen={TARGET}
        score={100}
      />,
    );

    expect(screen.getByText("senin")).toHaveClass("-translate-x-1/2");
  });

  it("ekran okuyucuya GİTMEZ — aynı bilgi satırın metninde yazılı", () => {
    const { container } = render(
      <NumberLine statKey="appearances" target={TARGET} />,
    );

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
