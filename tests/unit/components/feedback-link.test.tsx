// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeedbackLink } from "@/components/feedback-link";

afterEach(cleanup);

/**
 * Geri bildirim düğmesi — üç kip (§7.4). Karar sunucu bileşenindedir; ölçütler
 * (`email`, `formEnabled`) düzenden prop olarak gelir.
 */
describe("FeedbackLink — üç kip", () => {
  it("form açıkken formu açan bir DÜĞME çizer (mailto DEĞİL)", () => {
    render(<FeedbackLink email="sahip@ornek.test" formEnabled />);

    // Tetikleyici bir <button>; erişilebilir adı görünen etiketiyle aynı.
    expect(
      screen.getByRole("button", { name: /geri bildirim/iu }),
    ).toBeInTheDocument();
    // Form kipinde bağlantı yoktur — gönderim sunucuya POST edilir.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("form kapalı ama adres varsa MAILTO düğmesine düşer", () => {
    render(<FeedbackLink email="sahip@ornek.test" formEnabled={false} />);

    const link = screen.getByRole("link", { name: /geri bildirim/iu });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:sahip@ornek.test"),
    );
  });

  it("form kapalı ve adres yoksa HİÇBİR ŞEY çizmez", () => {
    const { container } = render(
      <FeedbackLink email={undefined} formEnabled={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
