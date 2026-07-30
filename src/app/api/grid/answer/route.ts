import type { NextRequest } from "next/server";
import { gameModes } from "@/application/game-modes";
import { GRID_MODE_ID } from "@/application/game-modes/grid";
import { ValidationError } from "@/domain/errors/domain-error";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `POST /api/grid/answer` — bir hücreye verilen cevabın doğrulanması
 * (PROJECT.md §6.4, BR-12).
 *
 * NEDEN POST. İşlem sunucu durumunu değiştirmiyor; bu yönüyle GET de olabilirdi
 * ve GET, CDN'in tekrar eden cevapları emmesini sağlardı. POST seçildi çünkü
 * cevap denemeleri kullanıcının OYUN İLERLEYİŞİDİR: GET olsaydı her deneme
 * tarayıcı geçmişine, sunucu erişim loglarına ve paylaşılan önbelleğe URL
 * olarak yazılırdı — aynı ızgarayı henüz oynamamış birinin, başkasının
 * denemelerini bir kayıttan okuyabilmesi demek.
 *
 * İSTEMCİNİN KRİTERLERİNE GÜVENİLMEZ. Gövde yalnızca hücre koordinatı ve
 * oyuncu kimliği taşır; hangi kriterin hangi hücrede olduğunu sunucu ızgarayı
 * YENİDEN ÜRETEREK bulur (`daily-grid.ts`). İstemci kriter gönderebilseydi
 * kendi ızgarasını uydurup her cevabı doğru yaptırabilirdi.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/grid/answer",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Yanıt kişiye özel bir oyun eylemidir; paylaşılan önbelleğe girmez.
    cacheable: false,
    run: async () => {
      // Gövdenin JSON olduğu bile varsayılmaz: bozuk gövde 400'dür, 500 değil.
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const mode = gameModes.get(GRID_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${GRID_MODE_ID} (§9).`);
      }

      // Şekil denetimi modun kendi şemasında (§2.3); burada yalnızca eylem
      // sabitlenir ki istemci "daily" gönderip bu uçtan ızgara çekemesin.
      return mode.run({ ...asRecord(body), action: "answer" }, repositories);
    },
  });
}

/**
 * Yayılım (`...`) yalnızca nesnelere uygulanır.
 *
 * Gövde dizi, dize ya da `null` geldiğinde yayılım sessizce boş bir nesne
 * üretir ve mod şeması "eksik alan" der — doğru sonuç, ama tesadüfen doğru.
 * Burada açıkça daraltılıyor.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
