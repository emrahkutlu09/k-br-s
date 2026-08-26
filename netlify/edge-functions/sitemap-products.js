export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  
  // API Key'inizi (key=...) koruyarak limitleri 5000'e çektik ve Mağazaları da listeye ekledik
  const productsUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/products?pageSize=5000&key=AIzaSyCHms5Y5x-KOu3Y43FrfRoljmW_4m3H4yY";
  const storesUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores?pageSize=5000&key=AIzaSyCHms5Y5x-KOu3Y43FrfRoljmW_4m3H4yY";
  
  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Ön yüzdeki slugify fonksiyonunun BİREBİR aynısı (SEO uyuşmazlığı olmaması için)
  const slugify = (text, defaultStr) => {
    if(!text) return defaultStr;
    return text.toString().toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
  };

  try {
    // 1. ÜRÜNLERİ ÇEK VE EKLE
    const prodRes = await fetch(productsUrl);
    const prodData = await prodRes.json();
    
    if (prodData.documents && Array.isArray(prodData.documents)) {
      prodData.documents.forEach(doc => {
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        
        let titleStr = doc.fields?.title?.stringValue || "urun";
        const slug = slugify(titleStr, "urun");
        
        xmlContent += `  <url>\n    <loc>${baseUrl}/urun/${slug}-${id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      });
    } else {
      xmlContent += `  <!-- Bilgi: Ürün verisi farklı geldi. Anahtarlar: ${Object.keys(prodData).join(', ')} -->\n`;
    }

    // 2. MAĞAZALARI ÇEK VE EKLE (Lokal SEO için Çok Kritik)
    const storeRes = await fetch(storesUrl);
    const storeData = await storeRes.json();
    
    if (storeData.documents && Array.isArray(storeData.documents)) {
      storeData.documents.forEach(doc => {
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        
        let nameStr = doc.fields?.name?.stringValue || "magaza";
        const slug = slugify(nameStr, "magaza");
        
        xmlContent += `  <url>\n    <loc>${baseUrl}/magaza/${slug}-${id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      });
    }

    // 3. STATİK SAYFALARI EKLE
    xmlContent += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    xmlContent += `  <url>\n    <loc>${baseUrl}/satici.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;

  } catch (error) {
    xmlContent += `  <!-- Hata Detayı: ${error.message} -->\n`;
  }
  
  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, s-maxage=43200"
    },
  });
};
```eof

Bu kodla birlikte sitemap'iniz artık hem **ürünleri**, hem **mağazaları**, hem de **ana sayfayı** tek bir dosyada, en yüksek limitlerle (5000) Google'a bildirecek. 

Süper ilerliyoruz! Sırada `seo-bot.js` kodunu güncelleyip (JSON-LD eklemesi için) işlemleri bitirmek kaldı sanırım? Onu zaten bir önceki adımda atmıştım, başka yapmamız gereken veya düzeltmemi istediğiniz bir yer var mı?
