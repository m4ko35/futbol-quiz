import { describe, expect, it } from "vitest";
import type {
  Account,
  AccountsRepository,
  SaveReportResult,
} from "@/application/ports/accounts-repository";
import { reportDisplayName } from "@/application/use-cases/report-display-name";
import type { ReportReason } from "@/domain/value-objects/report-reason";

/**
 * Görünen ad bildirimi — PROJECT.md §11.12, BR-53.
 *
 * Buradaki testler DEPOLAMAYI değil KARARI ölçüyor: kim kimi bildirebilir,
 * ne zaman reddedilir ve sonucun kullanıcıya ne söylediği. Kısıtların gerçekten
 * var olduğu ayrıca `tests/integration/accounts-repository.test.ts` içinde
 * gerçek şemayla ölçülüyor.
 */

interface Yazilan {
  readonly reporterId: string;
  readonly reportedId: string;
  readonly reason: ReportReason;
}

class SahteDepo implements Partial<AccountsRepository> {
  readonly yazilanlar: Yazilan[] = [];
  sonuc: SaveReportResult = "yazildi";

  constructor(private readonly kullanicilar: ReadonlyMap<string, Account>) {}

  findByDisplayNameKey(key: string): Promise<Account | null> {
    return Promise.resolve(this.kullanicilar.get(key) ?? null);
  }

  saveNameReport(input: Yazilan): Promise<SaveReportResult> {
    this.yazilanlar.push(input);
    return Promise.resolve(this.sonuc);
  }
}

const BILDIREN: Account = { id: "u-bildiren", displayName: "Bildiren" };
const HEDEF: Account = { id: "u-hedef", displayName: "Hedef Oyuncu" };

function kur() {
  const depo = new SahteDepo(
    new Map([
      ["bildiren", BILDIREN],
      // `toSearchKey` boşluğu AYIRICI olarak koruyor: "Hedef Oyuncu" anahtarı
      // "hedef oyuncu" olur, "hedefoyuncu" değil. Bunu bir test yakaladı.
      ["hedef oyuncu", HEDEF],
    ]),
  );
  return { depo, deps: { accounts: depo as unknown as AccountsRepository } };
}

describe("reportDisplayName — BR-53", () => {
  it("bildirimi kaydeder", async () => {
    const { depo, deps } = kur();

    await expect(
      reportDisplayName(
        { reporter: BILDIREN, reportedName: "Hedef Oyuncu", reason: "hakaret" },
        deps,
      ),
    ).resolves.toBe("alindi");

    expect(depo.yazilanlar).toEqual([
      { reporterId: "u-bildiren", reportedId: "u-hedef", reason: "hakaret" },
    ]);
  });

  /**
   * Arama NORMALLEŞTİRİLMİŞ anahtarla yapılıyor: tabloda gördüğü adı farklı
   * harf büyüklüğüyle yazan kullanıcının bildirimi sessizce boşa düşmemeli.
   */
  it("büyük/küçük harf ve boşluk farkı bildirimi boşa düşürmez", async () => {
    const { depo, deps } = kur();

    await expect(
      reportDisplayName(
        { reporter: BILDIREN, reportedName: "hedef oyuncu", reason: "reklam" },
        deps,
      ),
    ).resolves.toBe("alindi");

    expect(depo.yazilanlar).toHaveLength(1);
  });

  /** Sayım "kaç kişi rahatsız oldu" sorusunun cevabı olmalı (§11.12). */
  it("kullanıcı KENDİ adını bildiremez", async () => {
    const { depo, deps } = kur();

    await expect(
      reportDisplayName(
        { reporter: BILDIREN, reportedName: "Bildiren", reason: "hakaret" },
        deps,
      ),
    ).resolves.toBe("kendini-bildiremez");

    expect(depo.yazilanlar).toHaveLength(0);
  });

  it("olmayan ad reddedilir ve hiçbir şey yazılmaz", async () => {
    const { depo, deps } = kur();

    await expect(
      reportDisplayName(
        { reporter: BILDIREN, reportedName: "Hic Yok", reason: "taklit" },
        deps,
      ),
    ).resolves.toBe("kullanici-yok");

    expect(depo.yazilanlar).toHaveLength(0);
  });

  /**
   * İKİNCİ BİLDİRİM DE "alindi" DÖNER.
   *
   * Kullanıcı kendi bildirimini zaten biliyor; ayrımı yüzeye taşımak ona bir
   * şey kazandırmaz ama ikinci denemeyi bir hata gibi gösterirdi.
   */
  it("zaten bildirilmiş hedef de 'alindi' döner", async () => {
    const { depo, deps } = kur();
    depo.sonuc = "zaten-bildirdi";

    await expect(
      reportDisplayName(
        { reporter: BILDIREN, reportedName: "Hedef Oyuncu", reason: "hakaret" },
        deps,
      ),
    ).resolves.toBe("alindi");
  });
});
