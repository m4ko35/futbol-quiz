import { describe, expect, it } from "vitest";
import {
  isReportReason,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
} from "@/domain/value-objects/report-reason";

/**
 * Bildirim sebepleri — PROJECT.md §11.12, BR-53.
 *
 * Sınır koruması burada ölçülüyor: uca gelen değer §2.3 gereği ayrıştırılmadan
 * içeri geçemez ve bu koruma betiğin de kullandığı tek kapıdır.
 */
describe("bildirim sebebi", () => {
  it("yalnızca T5'in adlandırdığı üç sebebi tanır", () => {
    expect([...REPORT_REASONS]).toEqual(["hakaret", "taklit", "reklam"]);
  });

  it("bilinmeyen değeri reddeder", () => {
    for (const value of ["", "spam", "HAKARET", "hakaret ", "diger"]) {
      expect(isReportReason(value)).toBe(false);
    }
  });

  it("tanınan değerleri kabul eder", () => {
    for (const reason of REPORT_REASONS)
      expect(isReportReason(reason)).toBe(true);
  });

  /**
   * Etiket eksikliği derleme zamanında da yakalanır (`Record<ReportReason, …>`)
   * ama boş bir etiket yakalanmaz — arayüzde görünmez bir seçenek olurdu.
   */
  it("her sebebin gösterilebilir bir etiketi var", () => {
    for (const reason of REPORT_REASONS) {
      expect(REPORT_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });
});
