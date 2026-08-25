export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const firestoreUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/products?pageSize=100&key=AIzaSyCHms5Y5x-KOu3Y43FrfRoljmW_4m3H4yY";
  
  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  try {
    const response = await fetch(firestoreUrl);
    const data = await response.json();
    
    // Ürünlerin gelip gelmediğini anlamak için kontrol ekliyoruz
    if (data.documents && Array.isArray(data.documents)) {
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
    } else {
      // Eğer Firebase'den veri yapısı farklı geldiyse bunu XML içinde görelim
      xmlContent += `  <!-- Bilgi: Veri geldi ama documents bulunamadı. Gelen veri anahtarları: ${Object.keys(data).join(', ')} -->\n`;
    }
  } catch (error) {
    xmlContent += `  <!-- Hata Detayı: ${error.message} -->\n`;
  }
  
  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
};
