// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClubCrest } from "@/components/club-crest";

afterEach(cleanup);

const CREST = "https://upload.wikimedia.org/wikipedia/commons/d/d0/Milan.svg";

describe("ClubCrest", () => {
  it("armayı gösterir", () => {
    const { container } = render(<ClubCrest club={{ crestUrl: CREST }} />);

    expect(container.querySelector("img")).toHaveAttribute("src", CREST);
  });

  it("ekran okuyucuya GÖRÜNMEZ — ad zaten yanında yazıyor", () => {
    // Süsleme kuralı (WCAG 1.1.1): armayı "Galatasaray arması" diye
    // seslendirmek, yanındaki adı ikinci kez okumak olurdu.
    render(<ClubCrest club={{ crestUrl: CREST }} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("boyutu sabittir — yerleşim kaymasını (CLS) önler", () => {
    const { container } = render(
      <ClubCrest club={{ crestUrl: CREST }} size={24} />,
    );
    const img = container.querySelector("img");

    expect(img).toHaveAttribute("width", "24");
    expect(img).toHaveAttribute("height", "24");
  });

  it("geç yüklenir", () => {
    const { container } = render(<ClubCrest club={{ crestUrl: CREST }} />);

    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("arma yoksa yer AYIRIR ama resim koymaz", () => {
    // Yer ayrılmazsa listedeki adlar armalı/armasız satırlar arasında kayar.
    const { container } = render(
      <ClubCrest club={{ crestUrl: null }} size={20} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveStyle({ width: "20px" });
  });
});
