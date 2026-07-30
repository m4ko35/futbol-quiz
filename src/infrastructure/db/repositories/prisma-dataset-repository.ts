import type { DatasetRepository } from "@/application/ports/dataset-repository";
import type { PrismaClient } from "@/generated/prisma";

/** `DatasetRepository` port'unun Prisma uygulaması (PROJECT.md §4.1, §5.2). */
export class PrismaDatasetRepository implements DatasetRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  async getGeneratedAt(): Promise<Date | null> {
    // Künye tek satırdır ve kimliği sabittir (§5.2). Kayıt yoksa — ETL henüz
    // tam koşmamışsa — `null` döner ve arayüz tarih göstermez.
    const meta = await this.#prisma.datasetMeta.findUnique({
      where: { id: 1 },
    });
    return meta?.generatedAt ?? null;
  }
}
