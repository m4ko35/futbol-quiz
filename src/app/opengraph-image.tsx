import { ImageResponse } from "next/og";

/**
 * Paylaşım görseli (Open Graph / Twitter) — PROJECT.md §7.11.
 *
 * NEDEN ÜRETİLEN, STATİK BİR PNG DEĞİL. Görsel kod tabanında yaşar: markanın
 * kendi işaretini ve palet belirteçlerini kullanır, bir ikili varlık olarak
 * depoya girmez. Değişiklik istendiğinde düzenlenecek yer JSX'tir, bir tasarım
 * dosyası değil.
 *
 * NEDEN İSTEK YOLU DEĞİL. Bu dosya istek-anı API'si (cookies/headers/connection)
 * KULLANMAZ; dolayısıyla Next onu DERLEME ANINDA bir kez üretir ve statik PNG
 * olarak servis eder. §7.4 "istek yolunda ağ çıkışı" kuralının konusu değildir.
 *
 * NEDEN METİN ASCII. `ImageResponse`'un varsayılan fontu temel Latin'i çizer;
 * Türkçenin `ı/İ/ş/ğ/ç` harfleri (§7.12, Latin Extended-A) için ayrı bir font
 * dosyası GEREKİRDİ ve onu ağdan çekmek §7.4'e, depoya gömmek gereksiz bir
 * ikili varlığa yol açardı. Görselin işi marka tanınırlığı: işaret + kelime
 * markası. Tam Türkçe tanıtım zaten `og:description`'dadır — sosyal platform onu
 * görselin ALTINDA metin olarak gösterir, görselin İÇİNDE tekrar etmeye gerek
 * yok.
 */

// `alt` bir HTML meta değeridir (görselin İÇİNE çizilmez); burada Türkçe serbest.
export const alt = "Futbol Challenge — iki kulübün ortak oyuncularını bul";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

/**
 * Marka işareti — `icon.svg` ile AYNI rozet (accent mavi yuvarlak kare + beyaz
 * kesişim işareti, dolu mercek = `A ∩ B`). Renk markanın accent'i (`#1d34d1`);
 * eski yeşil accent yeşilken kalmış bir izdi.
 *
 * VERİ-URI `<img>` olarak gömülüyor, satır içi `<svg>` olarak değil: Satori'nin
 * `clipPath` desteği eksiktir, resvg (veri-URI'yi rasterleştiren) ise tam
 * destekler — mercek ancak böyle sadık çizilir.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="196" height="196"><defs><clipPath id="l"><circle cx="13" cy="16" r="7"/></clipPath></defs><rect width="32" height="32" rx="8" fill="#1d34d1"/><circle cx="13" cy="16" r="7" fill="none" stroke="#ffffff" stroke-width="2.2"/><circle cx="19" cy="16" r="7" fill="none" stroke="#ffffff" stroke-width="2.2"/><circle cx="19" cy="16" r="7" fill="#ffffff" clip-path="url(#l)"/></svg>`;

const MARK_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(MARK_SVG)}`;

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "88px",
        // Sitenin koyu teması: accent rozet bu koyu zeminde bir uygulama ikonu
        // gibi durur ve akışta göze çarpar.
        background: "linear-gradient(135deg, #0b1220 0%, #070c14 100%)",
        color: "#e9eff7",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "44px" }}>
        {/* ImageResponse (Satori) yalnızca <img> çizer; next/image çalışmaz.
            `no-img-element` bu metadata görsel rotasında eslint-config-next
            tarafından zaten muaf; inline disable CI'da (Linux) "kullanılmıyor"
            uyarısı veriyordu (§8.3). */}
        <img width={196} height={196} src={MARK_DATA_URI} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 104,
              fontWeight: 700,
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            Futbol Challenge
          </div>
          <div style={{ fontSize: 46, color: "#96a3b6", marginTop: 20 }}>
            Ortak oyuncular
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        {/* Mavi aksan çubuğu — arayüzün `--accent` belirteci (#1d34d1). */}
        <div
          style={{
            width: 72,
            height: 10,
            borderRadius: 5,
            background: "#1d34d1",
          }}
        />
        <div style={{ fontSize: 34, color: "#96a3b6" }}>
          24 lig, tarihsel kadrolar
        </div>
      </div>
    </div>,
    { ...size },
  );
}
