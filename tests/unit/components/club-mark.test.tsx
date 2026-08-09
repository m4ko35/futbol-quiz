// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClubMark } from "@/components/club-mark";

afterEach(cleanup);

const CREST = "https://upload.wikimedia.org/wikipedia/commons/d/d0/Milan.svg";

function club(overrides: {
  crestUrl: string | null;
  shortName?: string;
  country?: string | null;
}) {
  return {
    shortName: "AC Milan",
    country: "IT",
    ...overrides,
  };
}

describe("ClubMark — BR-35", () => {
  it("armayı gösterir", () => {
    const { container } = render(<ClubMark club={club({ crestUrl: CREST })} />);

    expect(container.querySelector("img")).toHaveAttribute("src", CREST);
  });

  it("ekran okuyucuya GÖRÜNMEZ — ad zaten yanında yazıyor", () => {
    // Süsleme kuralı (WCAG 1.1.1): işareti "Galatasaray arması" diye
    // seslendirmek, yanındaki adı ikinci kez okumak olurdu.
    render(<ClubMark club={club({ crestUrl: CREST })} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("boyutu sabittir — yerleşim kaymasını (CLS) önler", () => {
    const { container } = render(
      <ClubMark club={club({ crestUrl: CREST })} size={24} />,
    );
    const img = container.querySelector("img");

    expect(img).toHaveAttribute("width", "24");
    expect(img).toHaveAttribute("height", "24");
  });

  it("geç yüklenir", () => {
    const { container } = render(<ClubMark club={club({ crestUrl: CREST })} />);

    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  /**
   * BR-35'İN ÇEKİRDEĞİ. Önceki bileşen burada BOŞ bir kare bırakıyordu ve
   * armanın kapsamı %43,7 olduğu için listelerin yarısı delik görünüyordu.
   */
  it("arma yoksa BOŞ BIRAKMAZ, baş harfleri koyar", () => {
    const { container } = render(
      <ClubMark
        club={club({
          crestUrl: null,
          shortName: "Manchester United",
          country: "GB",
        })}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("MAU");
  });

  /**
   * KARO ÖLÇÜSÜ ÜÇ HARFİN ÖNKOŞULU (§7.13). Üç harf 20 px'lik yuvada
   * okunmuyordu; iki harfin ilk gerekçesi buydu. Varsayılan küçültülürse
   * harf sayısı kararı da yeniden ölçülmelidir — bu test o bağı tutuyor.
   */
  it("varsayılan yuva 26 px", () => {
    const { container } = render(
      <ClubMark club={club({ crestUrl: null, shortName: "Everton" })} />,
    );

    expect(container.firstElementChild).toHaveStyle({
      width: "26px",
      height: "26px",
    });
  });

  it("üç harf iki harften küçük punto ile yazılır", () => {
    // Aynı oranda yazıldığında üçüncü harf yuvadan taşıyor.
    const ucHarf = render(
      <ClubMark club={club({ crestUrl: null, shortName: "Everton" })} />,
    ).container.firstElementChild;
    const ikiHarf = render(
      <ClubMark club={club({ crestUrl: null, shortName: "A" })} />,
    ).container.firstElementChild;

    const punto = (el: Element | null) =>
      Number.parseFloat((el as HTMLElement).style.fontSize);

    expect(punto(ucHarf)).toBeLessThan(punto(ikiHarf));
  });

  it("baş harflerde kulübün ülkesini dikkate alır", () => {
    // Türkçe büyük harf kuralı yalnızca Türk kulüplerinde uygulanır (§7.13).
    const { container } = render(
      <ClubMark
        club={club({ crestUrl: null, shortName: "Sivasspor", country: "TR" })}
      />,
    );

    expect(container).toHaveTextContent("SİV");
  });

  it("baş harf yuvası da aynı ölçüyü tutar", () => {
    // İki dal aynı yuvayı doldurmazsa liste armalı/armasız satırlar arasında
    // kayar — boş kareyi doğuran sorunun ta kendisi.
    const { container } = render(
      <ClubMark
        club={club({ crestUrl: null, shortName: "Everton", country: "GB" })}
        size={28}
      />,
    );

    expect(container.firstElementChild).toHaveStyle({
      width: "28px",
      height: "28px",
    });
  });

  it("baş harf yuvası da ekran okuyucudan gizlenir", () => {
    const { container } = render(
      <ClubMark club={club({ crestUrl: null, shortName: "Everton" })} />,
    );

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
