export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  
  // Firebase'den aktif ürünleri çeken resmi Google bağlantısı
  const firestoreUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/products?pageSize=500";
  
  // XML Başlangıcı
  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // Ana Sayfa (Sabit)
  xmlContent += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>always</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  try {
    // Veritabanına anlık olarak bağlanıp ürünleri çekiyoruz
    const response = await fetch(firestoreUrl);
    const data = await response.json();
    
    if (data.documents) {
      data.documents.forEach(doc => {
        // Ürün ID'sini ayıkla
        const nameParts = doc.name.split('/');
        const id = nameParts[nameParts.length - 1];
        
        // Ürün başlığını link formatına (slug) çevir
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
        
        // Her bir ürün için otomatik link oluştur
        xmlContent += `  <url>\n    <loc>${baseUrl}/urun/${title}-${id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      });
    }
  } catch (error) {
    console.error("Firebase sitemap hatası:", error);
  }
  
  // XML Bitişi
  xmlContent += `</urlset>`;
  
  // Arama motorlarına bunun bir web sayfası değil, XML Haritası olduğunu belirtiyoruz
  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
};
