import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/infrastructure/db/database-url";

const CWD = process.platform === "win32" ? "C:\\app" : "/app";

describe("resolveDatabaseUrl", () => {
  it("göreli yolu `prisma/` klasörüne göre mutlaklaştırır", () => {
    // Prisma CLI `file:./dev.db`'yi schema.prisma'nın klasörüne göre çözer;
    // aynı dosyaya varmak için taban aynı olmalı.
    const url = resolveDatabaseUrl("file:./dev.db", CWD);

    expect(url.startsWith("file:")).toBe(true);
    expect(url).toContain("prisma");
    expect(url).toContain("dev.db");
    expect(url).not.toContain("./");
  });

  it("çözülen yol gerçekten `<cwd>/prisma/dev.db`'dir", () => {
    expect(resolveDatabaseUrl("file:./dev.db", CWD)).toBe(
      `file:${path.resolve(CWD, "prisma", "dev.db")}`,
    );
  });

  it("URL değil DÜZ DOSYA YOLU üretir", () => {
    // Prisma `file:` önekinden sonrasını dosya yolu olarak okur. İlk sürüm
    // `pathToFileURL().pathname` kullanıyordu; Windows'ta başa `/` eklediği
    // için (`file:/C:/…`) derleme "Error code 14" ile düşmüştü.
    const url = resolveDatabaseUrl("file:./dev.db", CWD);

    expect(url).not.toMatch(/^file:\/\//u);
    if (process.platform === "win32") {
      expect(url).toMatch(/^file:[A-Za-z]:/u);
    }
    // Yüzde kodlaması yapılmaz — yol bir URL değil.
    expect(url).not.toContain("%");
  });

  it("mutlak yola DOKUNMAZ — dağıtım ortamı tam yolu verebilmeli", () => {
    const absolute =
      process.platform === "win32"
        ? "file:C:\\var\\task\\prisma\\dev.db"
        : "file:/var/task/prisma/dev.db";

    expect(resolveDatabaseUrl(absolute, CWD)).toBe(absolute);
  });

  it("dosya olmayan adresi olduğu gibi bırakır", () => {
    // Postgres'e geçilirse (§10.2) dosya yolu çözümlemesi anlamsızdır.
    const pg = "postgresql://user:pass@host:5432/db?schema=public";

    expect(resolveDatabaseUrl(pg, CWD)).toBe(pg);
  });

  it("çalışma klasörü değişince adres de değişir", () => {
    // Asıl mesele bu: sunucusuz ortamda çalışma klasörü yereldekiyle aynı
    // değil. Fonksiyon cwd'yi gerçekten okuyor mu?
    const a = resolveDatabaseUrl("file:./dev.db", CWD);
    const b = resolveDatabaseUrl(
      "file:./dev.db",
      process.platform === "win32" ? "C:\\var\\task" : "/var/task",
    );

    expect(a).not.toBe(b);
  });
});
