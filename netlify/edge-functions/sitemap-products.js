export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  
  // API Urls (pageSize 300 güvenli limit olarak kalır, ancak döngüyle tüm sayfalar çekilir)
  const productsBaseUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/products?pageSize=300&key=AIzaSyCHms5Y5x-KOu3Y43FrfRoljmW_4m3H4yY";
  const storesBaseUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores?pageSize=300&key=AIzaSyCHms5Y5x-KOu3Y43FrfRoljmW_4m3H4yY";
  
  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

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

  // SAYFALAMA (PAGINATION) İLE TÜM VERİLERİ KOPARIP ALAN AKILLI DÖNGÜ
  async function fetchAllData(apiUrl) {
    let allDocuments = [];
    let pageToken = "";
    
    // Güvenlik ve maksimum hız için 15 döngü limiti (15 x 300 = 4500 ürüne kadar destekler)
    for (let i = 0; i < 15; i++) {
      let fetchUrl = apiUrl;
      if (pageToken) {
        fetchUrl += `&pageToken=${pageToken}`;
      }
      
      const response = await fetch(fetchUrl);
      const data = await response.json();
      
      if (data.documents) {
        allDocuments = allDocuments.concat(data.documents);
      }
      
      // Eğer Firebase "Daha ürün var, sıradaki sayfa kodu bu" derse, devam et
      if (data.nextPageToken) {
        pageToken = data.nextPageToken;
      } else {
        break; // Başka sayfa kalmadıysa (tüm ürünler çekildiyse) döngüyü bitir
      }
    }
    return allDocuments;
  }

  try {
    // 1. ÜRÜNLERİ ÇEK (Döngü ile tüm 1500+ ürün gelir)
    const allProducts = await fetchAllData(productsBaseUrl);
    
    if (allProducts.length > 0) {
      allProducts.forEach(doc => {
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        let titleStr = doc.fields?.title?.stringValue || "urun";
        const slug = slugify(titleStr, "urun");
        xmlContent += `  <url>\n    <loc>${baseUrl}/urun/${slug}-${id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      });
    }

    // 2. MAĞAZALARI ÇEK
    const allStores = await fetchAllData(storesBaseUrl);
    
    if (allStores.length > 0) {
      allStores.forEach(doc => {
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        let nameStr = doc.fields?.name?.stringValue || "magaza";
        const slug = slugify(nameStr, "magaza");
        xmlContent += `  <url>\n    <loc>${baseUrl}/magaza/${slug}-${id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      });
    }

    // 3. STATİK SAYFALAR
    xmlContent += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    xmlContent += `  <url>\n    <loc>${baseUrl}/satici.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;

  } catch (error) {
    xmlContent += `  <!-- Hata Detayı: ${error.message} -->\n`;
  }
  
  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, s-maxage=43200" // 12 SAATLİK KORUMA (Hız ve Kota Tasarrufu)
    },
  });
};
