import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

/**
 * Bu yapılandırma PROJECT.md'deki iki kuralı otomatik olarak zorlar:
 *   §2.1 — katmanlar arası bağımlılık yönü (içe doğru)
 *   §7.2 — enjeksiyon karşıtı kod kuralları
 *
 * Bir kural gevşetilecekse önce PROJECT.md güncellenir.
 */

/** Katman ihlali mesajını tek yerden üret. */
const layerViolation = (layer, allowed) =>
  `Katman ihlali: '${layer}' katmanı buraya bağımlı olamaz. İzin verilen: ${allowed}. Bkz. PROJECT.md §2.1 ve §4.1.`;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "scripts/etl/.cache/**",
    // Prisma'nin urettigi istemci — bizim yazdigimiz kod degil.
    "src/generated/**",
  ]),

  // ─── Tüm TypeScript dosyaları: güvenlik ve tip disiplini ───────────────
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      // §2.5 — 'any' tip güvencesini sessizce yok eder.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // §7.2 — kod çalıştıran yapılar.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",

      // §7.2 — React'in otomatik XSS kaçışını devre dışı bırakan tek yol.
      "react/no-danger": "error",

      // §7.2 — parametreli olmayan ham SQL. Prisma'nın *Unsafe varyantları
      // dize birleştirmeye izin verdiği için SQL injection'a açıktır.
      "no-restricted-properties": [
        "error",
        {
          object: "prisma",
          property: "$queryRawUnsafe",
          message:
            "SQL injection riski. Prisma sorgu kurucusunu veya `Prisma.sql` etiketli şablonunu kullanın (PROJECT.md §7.2).",
        },
        {
          object: "prisma",
          property: "$executeRawUnsafe",
          message:
            "SQL injection riski. Prisma sorgu kurucusunu veya `Prisma.sql` etiketli şablonunu kullanın (PROJECT.md §7.2).",
        },
      ],
    },
  },

  // ─── domain/: saf çekirdek. Hiçbir dış katmana ve çatıya bağımlı değil ──
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/application",
                "@/application/**",
                "@/infrastructure",
                "@/infrastructure/**",
                "@/app",
                "@/app/**",
                "@/components",
                "@/components/**",
                "next",
                "next/**",
                "react",
                "react-dom",
                "@prisma/client",
                // Prisma'nin urettigi istemci bu projede src/generated altinda
                // durur; "@prisma/client" desenine takilmaz, ayrica yazilir.
                "@/generated",
                "@/generated/**",
              ],
              message: layerViolation("domain", "yalnızca kendi içi"),
            },
          ],
        },
      ],
    },
  },

  // ─── application/: yalnızca domain'e bakar. Prisma'yı doğrudan görmez ───
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/infrastructure",
                "@/infrastructure/**",
                "@/app",
                "@/app/**",
                "@/components",
                "@/components/**",
                "next",
                "next/**",
                "react",
                "react-dom",
                "@prisma/client",
                "@/generated",
                "@/generated/**",
              ],
              message: layerViolation("application", "@/domain ve @/lib"),
            },
          ],
        },
      ],
    },
  },

  // ─── components/: sunum. Veriye doğrudan erişmez (§4.2) ────────────────
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/infrastructure",
                "@/infrastructure/**",
                "@prisma/client",
                "@/generated",
                "@/generated/**",
              ],
              message: layerViolation(
                "components",
                "@/application/dto ve @/lib",
              ),
            },
          ],
        },
      ],
    },
  },

  // Prettier en sonda: biçimlendirmeyle çakışan kuralları kapatır.
  prettier,
]);

export default eslintConfig;
