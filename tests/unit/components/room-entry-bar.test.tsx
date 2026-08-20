// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoomEntryBar } from "@/components/room-entry-bar";

/**
 * Odaya çağrı şeridi — PROJECT.md §12.7.
 *
 * Şeridin tek kararı hedef adres: girişsiz kullanıcıyı `/oda`'ya göndermek,
 * onu görünmez bir yönlendirmeye sokmak olurdu — orası zaten `/giris`'e
 * atıyor. Metin de değişiyor: "Oda kur" deyip giriş ekranı açan bir düğme
 * sözünü tutmaz.
 */

afterEach(cleanup);

describe("RoomEntryBar", () => {
  it("giriş yapmışa doğrudan odaya götürür", () => {
    render(<RoomEntryBar signedIn />);

    expect(screen.getByRole("link", { name: "Oda kur" })).toHaveAttribute(
      "href",
      "/oda",
    );
  });

  it("girişsiz kullanıcıya ne olacağını SÖYLER ve girişe götürür", () => {
    render(<RoomEntryBar signedIn={false} />);

    expect(
      screen.getByRole("link", { name: "Giriş yap ve oda kur" }),
    ).toHaveAttribute("href", "/giris");
  });

  it("oyunun kuralını tek cümlede anlatır", () => {
    render(<RoomEntryBar signedIn />);

    expect(
      screen.getByText(/aynı futbolcu ikinize açılır/u),
    ).toBeInTheDocument();
  });
});
