export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const match = request.url.match(/sitemap-products-(\d+)\.xml/);
  const page = match ? parseInt(match[1]) : 1;
  const pageSize = 1000;

  const productsBaseUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/products?pageSize=300";
  const storesBaseUrl = "https://firestore.googleapis.com/v1/projects/kibris-6b4f7/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores?pageSize=300";

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
    for (let i = 0; i < 20; i++) {
      let fetchUrl = apiUrl;
      if (pageToken) fetchUrl += `&pageToken=${pageToken}`;
      const response = await fetch(fetchUrl);
      const data = await response.json();
      if (data.documents) {
        allDocuments = allDocuments.concat(data.documents);
      }
      if (data.nextPageToken) {
        pageToken = data.nextPageToken;
      } else {
        break;
      }
    }
    return allDocuments;
  }

  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  try {
    const allProducts = await fetchAllData(productsBaseUrl);
    
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

    if (page === 1) {
      const allStores = await fetchAllData(storesBaseUrl);
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

  } catch (error) {
    xmlContent += `  <!-- Hata Detayi: ${error.message} -->\n`;
  }

  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, s-maxage=43200"
    },
  });
};
