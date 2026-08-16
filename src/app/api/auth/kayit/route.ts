import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  displayNameRejectionMessage,
  validateDisplayName,
} from "@/domain/value-objects/display-name";
import { accountsEnv } from "@/infrastructure/config/env";
import { accountsRepository } from "@/infrastructure/db/repositories";
import { createSessionValue } from "@/lib/auth/session";
import {
  PENDING_COOKIE,
  readPendingValue,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

/**
 * `POST /api/auth/kayit` — görünen adı alıp hesabı açar (§11.10, BR-46).
 *
 * BURAYA ANCAK GOOGLE'DA DOĞRULANMIŞ biri gelebilir: `sub` özeti, imzalı ve
 * kısa ömürlü bekleme çerezinden okunuyor. İstemci `sub` GÖNDEREMEZ —
 * gönderebilseydi herkes istediği hesabı açardı.
 */

const bodySchema = z.object({ displayName: z.string().max(200) });

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Kimliğe bağlı yanıt paylaşılan önbelleğe girmez (BR-47).
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const env = accountsEnv();
  if (env === null) return jsonError(404, "Bulunamadı.");

  const store = await cookies();
  const subjectHash = await readPendingValue(
    env.authSecret,
    store.get(PENDING_COOKIE)?.value,
    new Date(),
  );

  if (subjectHash === null) {
    return jsonError(401, "Giriş akışı sona ermiş. Tekrar giriş yapın.");
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Gövde geçersiz.");

  // BR-46 — doğrulama DOMAIN'de; buradaki iş yalnızca sonucu iletmek.
  const name = validateDisplayName(parsed.data.displayName);
  if (!name.ok) {
    return jsonError(400, displayNameRejectionMessage(name.reason));
  }

  const repository = accountsRepository();
  if (repository === null) return jsonError(404, "Bulunamadı.");

  const account = await repository.createAccount({
    subjectHash,
    displayName: name.value,
    displayNameKey: name.key,
  });

  /**
   * `null` iki şeyden biri: ad alınmış ya da bu Google hesabı zaten kayıtlı.
   * İKİSİ AYIRT EDİLMİYOR ve bu bilinçli değil bir kolaylık — ikinci durum
   * pratikte olamaz, çünkü buraya gelen kullanıcının hesabı olmadığı geri
   * dönüşte kontrol edildi. Kalan gerçek sebep adın alınmış olması.
   */
  if (account === null) {
    return jsonError(409, "Bu ad kullanılıyor. Başka bir ad seç.");
  }

  store.delete(PENDING_COOKIE);
  store.set(
    SESSION_COOKIE,
    await createSessionValue(env.authSecret, account.id, new Date()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );

  return new Response(
    JSON.stringify({ id: account.id, displayName: account.displayName }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
