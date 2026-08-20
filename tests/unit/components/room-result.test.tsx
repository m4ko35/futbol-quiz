// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ScoredAnswerDto } from "@/application/use-cases/answer-names";
import type { StatMatchRoundDto } from "@/application/use-cases/daily-stat-match";
import type { RoomDto, RoomSideDto } from "@/application/use-cases/rooms";
import { RoomResult } from "@/components/room-result";

/**
 * Oda sonucu — PROJECT.md §12, BR-62.
 *
 * Bu ekran odanın TEK ödülü: BR-60 gereği sonuç hiçbir yerde birikmiyor.
 * Testler görünümü değil sözleşmeyi ölçüyor — hangi bilgi ekranda, hangisi
 * değil.
 */

afterEach(cleanup);

const HEDEF: StatMatchRoundDto = {
  player: { id: "hedef", name: "Andrea Pirlo", nationality: "IT" },
  stats: [
    { key: "appearances", label: "Kulüp maçı", value: 435, scoped: true },
    { key: "goals", label: "Kulüp golü", value: 41, scoped: true },
  ],
};

function cevap(
  statKey: ScoredAnswerDto["statKey"],
  playerName: string,
  value: number,
  score: number,
): ScoredAnswerDto {
  return { statKey, playerId: playerName, playerName, value, score };
}

function taraf(
  displayName: string,
  answers: ScoredAnswerDto[],
  points: number,
): RoomSideDto {
  return { displayName, answered: answers.length, points, answers };
}

function bitmisOda(patch: Partial<RoomDto> = {}): RoomDto {
  return {
    code: "BKJ7TZ",
    status: "bitti",
    expiresAt: "2026-08-20T11:00:00.000Z",
    target: HEDEF,
    me: taraf(
      "Mehmet",
      [
        cevap("appearances", "Xavi", 421, 92),
        cevap("goals", "Toni Kroos", 28, 61),
      ],
      153,
    ),
    opponent: taraf(
      "Ali",
      [
        cevap("appearances", "Iniesta", 442, 88),
        cevap("goals", "Modric", 38, 94),
      ],
      182,
    ),
    outcome: "kaybettin",
    ...patch,
  };
}

describe("RoomResult", () => {
  it("her istatistikte iki tarafın seçtiği oyuncuyu YAN YANA gösterir", () => {
    render(<RoomResult room={bitmisOda()} />);

    const satirlar = screen.getAllByRole("listitem");
    expect(satirlar).toHaveLength(2);

    const ilk = within(satirlar[0] as HTMLElement);
    expect(ilk.getByText("Xavi")).toBeInTheDocument();
    expect(ilk.getByText("Iniesta")).toBeInTheDocument();
    // Hedef değer satırın sorusudur ve orada durmalı.
    expect(ilk.getByText("435")).toBeInTheDocument();
  });

  it("iki tarafın adını da her satırda yazar", () => {
    render(<RoomResult room={bitmisOda()} />);

    expect(screen.getAllByText("Mehmet")).toHaveLength(2);
    expect(screen.getAllByText("Ali")).toHaveLength(2);
  });

  /**
   * WCAG 1.4.1 — üstünlük RENKLE ANLATILMIYOR: iki yüzde de metin olarak
   * ekranda. Kalınlık yalnızca gözü hızlandırıyor.
   */
  it("puanları metin olarak yazar; renk tek gösterge değildir", () => {
    render(<RoomResult room={bitmisOda()} />);

    expect(screen.getByText("421 · %92")).toBeInTheDocument();
    expect(screen.getByText("442 · %88")).toBeInTheDocument();
  });

  /**
   * BR-60 SÖYLENMEDEN GEÇİLMEZ. Kullanıcı sonucun bir yere yazıldığını
   * sanarsa, bir saat sonra geri dönüp aradığında kaybını bize yazar.
   */
  it("sonucun saklanmadığını açıkça söyler (BR-60)", () => {
    render(<RoomResult room={bitmisOda()} />);

    expect(screen.getByText(/hiçbir yerde saklanmıyor/u)).toBeInTheDocument();
  });

  it("eksik cevabı tire ile gösterir, satırı gizlemez", () => {
    const oda = bitmisOda();
    render(
      <RoomResult
        room={{
          ...oda,
          opponent: { ...oda.opponent!, answers: [oda.opponent!.answers![0]!] },
        }}
      />,
    );

    const satirlar = screen.getAllByRole("listitem");
    expect(
      within(satirlar[1] as HTMLElement).getByText("—"),
    ).toBeInTheDocument();
  });

  /**
   * EKSİK VERİ SESSİZCE ÇİZİLMEZ. `bitti` durumu hedefi ve rakibi garanti
   * ediyor; garanti bozulursa boş bir tablo yerine hiçbir şey çizilmemeli.
   */
  it("hedef ya da rakip yoksa hiçbir şey çizmez", () => {
    const { container } = render(
      <RoomResult room={bitmisOda({ target: null })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
