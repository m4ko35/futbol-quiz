/**
 * Veri kümesinin künyesi — PORT (PROJECT.md §4.1, §5.2).
 *
 * Ayrı bir port olmasının sebebi, künyenin kulüp/oyuncu verisinden FARKLI bir
 * şey olması: o veri hakkında veri. `ClubRepository`'ye iliştirmek, "kulüpleri
 * getiren şey" ile "veri kümesi ne zaman üretildi" sorusunu aynı sözleşmeye
 * tıkmak olurdu.
 */
export interface DatasetRepository {
  /**
   * ETL koşusunun bittiği an; künye hiç yazılmamışsa `null`.
   *
   * `null` UYDURULMAZ (§2.7): tarih bilinmiyorsa arayüz tarih göstermez.
   * "Bugün" varsayılan olsaydı, bir yıl önce üretilmiş bir veri kümesi taze
   * görünürdü — yani tam olarak bu alanın engellemek için var olduğu hata.
   */
  getGeneratedAt(): Promise<Date | null>;

  /**
   * Seçim listesinde görünen kulüp sayısı — arayüzdeki kapsam bildirimi için.
   *
   * NEDEN VERİDEN OKUNUYOR: sayı sayfaya ELLE yazılmıştı ("345 kulüp") ve
   * kapsam genişletilmeden çok önce eskimişti; kullanıcıya gösterilen kapsam
   * bildirimi, tam olarak doğru olmadığında güven veren değil güven aşındıran
   * bir metindir. Aynı sınıfın ikinci kez oluşmaması için tek kaynak veridir.
   *
   * Künye port'una ait çünkü sorulan şey kulüplerin kendisi değil, VERİ KÜMESİ
   * hakkında bir olgu — `getGeneratedAt` ile aynı cinsten.
   */
  countSelectableClubs(): Promise<number>;
}
