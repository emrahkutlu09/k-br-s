let cachedProductsMap = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 saat önbellek

export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const now = Date.now();

  if (cachedProductsMap && (now - cacheTime < CACHE_DURATION)) {
    return new Response(cachedProductsMap, {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  }

  const firestoreUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/products?pageSize=300&key=AIzaSyCHms5Y5x-KOu3Y43FrfRoljmW_4m3H4yY";
  
  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  try {
    const response = await fetch(firestoreUrl);
    const data = await response.json();
    
    if (data.documents) {
      data.documents.forEach(doc => {
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        
        let title = "urun";
        if (doc.fields && doc.fields.title && doc.fields.title.stringValue) {
            title = doc.fields.title.stringValue.toLowerCase()
              .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
              .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
              .replace(/\s+/g, '-')
              .replace(/[^\w\-]+/g, '')
              .replace(/\-\-+/g, '-')
              .replace(/^-+/, '')
              .replace(/-+$/, '');
        }
        
        xmlContent += `  <url>\n    <loc>${baseUrl}/urun/${title}-${id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      });
    }
  } catch (error) {
    xmlContent += `  <!-- Hata: ${error.message} -->\n`;
  }
  
  xmlContent += `</urlset>`;

  cachedProductsMap = xmlContent;
  cacheTime = now;
  
  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
};
