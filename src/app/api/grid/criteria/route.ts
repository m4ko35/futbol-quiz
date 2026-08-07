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
 * `GET /api/grid/criteria` — "Sen kur" ızgarasında bir eksene konabilecek
 * ölçütler (PROJECT.md §9.1, BR-25).
 *
 * NEDEN GET. Burada oyun ilerleyişi yok, bir ARAMA var: kullanıcı yazdıkça
 * çağrılır ve dönen liste kullanıcıya zaten gösterilecek olandır. Cevap
 * ucunun (POST) gerekçesi burada geçerli değil.
 *
 * SIZINTI YOK. Liste yalnızca "bu ölçüt konabilir" der; hücrede kaç cevap
 * olduğunu SÖYLEMEZ (§9.1 sızıntı kuralı). Sayı, tahmin alanını daraltan bir
 * ipucudur — kullanıcı ızgarayı kendisi kursa bile oyunu kendi elinden almanın
 * anlamı yok.
 *
 * BİÇİM: `?with=club:<kimlik>&with=nationality:<KOD>&q=<metin>`. Tekrar eden
 * `with` parametresi seçilmiş sütunları taşır; ayrıştırma burada yapılır ama
 * DOĞRULAMA modun şemasındadır (§2.3).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/grid/criteria",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    run: () => {
      const params = request.nextUrl.searchParams;
      const against = params.getAll("with").map(toRef);

      if (against.length === 0) {
        throw new ValidationError('En az bir "with" ölçütü zorunludur.');
      }

      const mode = gameModes.get(GRID_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${GRID_MODE_ID} (§9).`);
      }

      const term = params.get("q");

      return mode.run(
        {
          action: "criteria",
          against,
          ...(term === null ? {} : { term }),
        },
        repositories,
      );
    },
  });
}

/**
 * `"club:abc"` → `{ kind: "club", id: "abc" }`.
 *
 * Tanınmayan bir tür SESSİZCE atlanmaz; olduğu gibi şemaya verilir ve şema
 * reddeder. Atlamak, kullanıcının seçtiği bir sütunu yok sayıp BAŞKA bir
 * ızgaranın ölçütlerini döndürmek olurdu.
 */
function toRef(value: string): { kind: string; id: string } {
  const at = value.indexOf(":");
  return at === -1
    ? { kind: value, id: "" }
    : { kind: value.slice(0, at), id: value.slice(at + 1) };
}
