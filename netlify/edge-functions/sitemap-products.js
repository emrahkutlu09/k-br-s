export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const match = request.url.match(/sitemap-products-(\d+)\.xml/);
  const page = match ? parseInt(match[1]) : 1;
  const pageSize = 1000;

  // Firebase API anahtarımızı geri ekledik
  const API_KEY = "AIzaSyCHms5Y5x-KOu3Y43FrfRoljmW_4m3H4yY";
  const productsBaseUrl = `https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/products?pageSize=300&key=${API_KEY}`;
  const storesBaseUrl = `https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores?pageSize=300&key=${API_KEY}`;

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

  async function fetchAllData(apiUrl) {
    let allDocuments = [];
    let pageToken = "";
    let apiError = null;

    for (let i = 0; i < 20; i++) {
      let fetchUrl = apiUrl;
      if (pageToken) fetchUrl += `&pageToken=${pageToken}`;
      
      try {
        // İŞTE SİHRİN OLDUĞU YER: Firebase'i site kimliğimizle ikna ediyoruz
        const response = await fetch(fetchUrl, {
          headers: {
            "Origin": "https://kibrisbazar.com",
            "Referer": "https://kibrisbazar.com/"
          }
        });
        const data = await response.json();
        
        // Eğer Firebase bir hata dönerse bunu yakalayıp kaydediyoruz
        if (data.error) {
          apiError = data.error.message;
          break;
        }
        if (data.documents) {
          allDocuments = allDocuments.concat(data.documents);
        }
        if (data.nextPageToken) {
          pageToken = data.nextPageToken;
        } else {
          break;
        }
      } catch (e) {
        apiError = e.message;
        break;
      }
    }
    return { docs: allDocuments, err: apiError };
  }

  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  let debugInfo = "";

  try {
    const prodData = await fetchAllData(productsBaseUrl);
    if (prodData.err) debugInfo += `[Urun Cekme Hatasi: ${prodData.err}] `;
    
    const allProducts = prodData.docs;
    if (allProducts && allProducts.length > 0) {
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageProducts = allProducts.slice(startIndex, endIndex);

      pageProducts.forEach(doc => {
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        let titleStr = doc.fields?.title?.stringValue || "urun";
        const slug = slugify(titleStr, "urun");
        xmlContent += `  <url>\n    <loc>${baseUrl}/urun/${slug}-${id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      });
    }

    // Statik linkler ve Mağazalar sadece 1. sayfada
    if (page === 1) {
      const storeData = await fetchAllData(storesBaseUrl);
      if (storeData.err) debugInfo += `[Magaza Cekme Hatasi: ${storeData.err}] `;
      
      const allStores = storeData.docs;
      if (allStores && allStores.length > 0) {
        allStores.forEach(doc => {
          const nameParts = doc.name.split('/');
          const id = nameParts[nameParts.length - 1];
          let nameStr = doc.fields?.name?.stringValue || "magaza";
          const slug = slugify(nameStr, "magaza");
          xmlContent += `  <url>\n    <loc>${baseUrl}/magaza/${slug}-${id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        });
      }

      xmlContent += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
      xmlContent += `  <url>\n    <loc>${baseUrl}/satici.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    // Dedektörümüz bir şey bulduysa XML'in altına yazar
    if (debugInfo) {
      xmlContent += `  <!-- FIREBASE API CEVABI: ${debugInfo} -->\n`;
    }

  } catch (error) {
    xmlContent += `  <!-- SISTEM HATASI: ${error.message} -->\n`;
  }

  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, s-maxage=43200"
    },
  });
};
