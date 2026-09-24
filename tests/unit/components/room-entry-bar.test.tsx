// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoomEntryBar } from "@/components/room-entry-bar";

/**
 * Odaya çağrı şeridi — PROJECT.md §12.7 / §12.8.
 *
 * Şeridin iki kararı: hedef adres ve moda göre metin. Girişsiz kullanıcıyı
 * `/oda`'ya göndermek onu görünmez bir yönlendirmeye sokardı — orası zaten
 * `/giris`'e atıyor; metin de o yüzden değişiyor ("Oda kur" deyip giriş ekranı
 * açan bir düğme sözünü tutmaz). §12.8: şerit lobiye modu ÖNSEÇİLİ götürüyor
 * (`/oda?mod=…`) ve metni moda göre değişiyor.
 */

afterEach(cleanup);

describe("RoomEntryBar", () => {
  it("giriş yapmışı modu önseçili olarak odaya götürür (İstatistik)", () => {
    render(<RoomEntryBar mode="istatistik" signedIn />);

    expect(screen.getByRole("link", { name: "Oda kur" })).toHaveAttribute(
      "href",
      "/oda?mod=istatistik",
    );
  });

  it("Hangisi Daha modunu önseçili taşır", () => {
    render(<RoomEntryBar mode="hangisi-daha" signedIn />);

    expect(screen.getByRole("link", { name: "Oda kur" })).toHaveAttribute(
      "href",
      "/oda?mod=hangisi-daha",
    );
  });

  it("girişsiz kullanıcıya ne olacağını SÖYLER ve girişe götürür", () => {
    render(<RoomEntryBar mode="hangisi-daha" signedIn={false} />);

    expect(
      screen.getByRole("link", { name: "Giriş yap ve oda kur" }),
    ).toHaveAttribute("href", "/giris");
  });

  it("İstatistik kuralını tek cümlede anlatır", () => {
    render(<RoomEntryBar mode="istatistik" signedIn />);

    expect(
      screen.getByText(/aynı futbolcu ikinize açılır/u),
    ).toBeInTheDocument();
  });

  it("Hangisi Daha kuralını tek cümlede anlatır", () => {
    render(<RoomEntryBar mode="hangisi-daha" signedIn />);

    expect(
      screen.getByText(/ikinize aynı düellolar açılır/u),
    ).toBeInTheDocument();
  });
});
