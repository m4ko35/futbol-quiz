/**
 * Wikitext'in iki temel okuma kuralı — PROJECT.md §4.3.
 *
 * NEDEN AYRI BİR DOSYA. Bu iki kural birden fazla ayrıştırıcının işine yarıyor
 * (bilgi kutusu ve kadro şablonu) ve **kopyalandıklarında aynı hatayı
 * çoğaltıyorlar**. Aynı ders bu projede bir kez ödendi: `sharesSeason` üç yere
 * ayrı ayrı yazılmıştı ve üçü de aynı biçimde yanlıştı (§4.3). Kural tek bir
 * yerde durursa yanlışı da tek bir yerde düzeltiliyor.
 *
 * Somut tuzak: wikitext'te alan ayracı ile bağlantı ayracı **aynı karakterdir**.
 * `name=[[Riki (footballer, born 1997)|Riki Rodríguez]]` alanını naif bir
 * `split("|")` ikiye böler ve geriye kapanmamış bir bağlantı bırakır — sonuç
 * hata değil, SESSİZ veri kaybıdır.
 */

/**
 * `openIndex` konumundaki `{{` ile eşleşen `}}` arasını döner.
 *
 * Derinlik sayılır: bilgi kutusu içinde `{{convert|1.79|m}}` gibi iç içe
 * şablonlar var ve ilk `}}` ile durmak kutuyu ortadan keser.
 */
export function readTemplate(text: string, openIndex: number): string | null {
  let depth = 0;

  for (let i = openIndex; i < text.length - 1;) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      if (depth === 0) return text.slice(openIndex + 2, i);
      i += 2;
    } else {
      i++;
    }
  }

  // Kapanmamış şablon — bozuk wikitext. Yarısını ayrıştırmaktansa atlamak
  // doğru: eksik kutu, yanlış kutudan iyidir.
  return null;
}

/**
 * Şablon gövdesini ÜST DÜZEY `|` işaretlerinden böler.
 *
 * Bölme yalnızca derinlik SIFIRKEN yapılır; `{{…}}` ve `[[…]]` içindeki
 * borular korunur — `[[1922 Konyaspor|Anadolu Selçukspor]]` tek parça kalır.
 * İlk parça şablon adıdır.
 *
 * Hem adlandırılmış alanlar (`tr`/`en`) hem konumsal argümanlar (`it`/`de`/
 * `fr`) bu bölmeyi kullanır; ikisinin farkı yorumlamada, ayırmada değil.
 */
export function splitTop(body: string): string[] {
  const parts: string[] = [];
  let current = "";
  let curly = 0;
  let square = 0;

  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2);

    if (pair === "{{" || pair === "[[") {
      if (pair === "{{") curly++;
      else square++;
      current += pair;
      i++;
      continue;
    }
    if (pair === "}}" || pair === "]]") {
      if (pair === "}}") curly--;
      else square--;
      current += pair;
      i++;
      continue;
    }
    if (body[i] === "|" && curly === 0 && square === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += body[i];
  }
  parts.push(current);

  return parts;
}
