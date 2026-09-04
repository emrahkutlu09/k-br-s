export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const match = request.url.match(/sitemap-products-(\d+)\.xml/);
  const targetPage = match ? parseInt(match[1]) : 1;
  const pageSize = 1000;

  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");
  
  if (!API_KEY || !projectId) {
    return new Response("Environment variables are missing.", { status: 500 });
  }

  const productsBaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/kibris-pazar/public/data/products`;

  const slugify = (text) => {
    if (!text) return 'urun';
    return text.toString().toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  let pageProducts = [];
  let pageToken = "";
  let currentFetchedPage = 1;

  try {
    while (currentFetchedPage <= targetPage) {
      // DÜZELTME: mask.fieldPaths eklenerek gereksiz veri (görsel/açıklama) çekimi durduruldu.
      // Sadece başlık, oluşturulma ve güncellenme tarihleri çekilir, bellek aşımı önlenir.
      let fetchUrl = `${productsBaseUrl}?pageSize=${pageSize}&mask.fieldPaths=title&mask.fieldPaths=updatedAt&mask.fieldPaths=createdAt&key=${API_KEY}`;
      if (pageToken) fetchUrl += `&pageToken=${pageToken}`;

      const response = await fetch(fetchUrl, {
        headers: { "Origin": baseUrl, "Referer": baseUrl + "/" }
      });

      if (!response.ok) {
        return new Response(`Firebase Products Fetch Error: ${response.status}`, { status: 500 });
      }

      const data = await response.json();
      
      if (currentFetchedPage === targetPage) {
        pageProducts = data.documents || [];
        break;
      }

      if (data.nextPageToken) {
        pageToken = data.nextPageToken;
        currentFetchedPage++;
      } else {
        pageProducts = [];
        break;
      }
    }
  } catch (error) {
    return new Response(`Internal Sitemap Error: ${error.message}`, { status: 500 });
  }

  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  if (pageProducts.length > 0) {
    pageProducts.forEach(doc => {
      const nameParts = doc.name.split('/');
      const id = nameParts[nameParts.length - 1];
      const titleStr = doc.fields?.title?.stringValue || "urun";
      const slug = slugify(titleStr);
      
      let lastmodTag = "";
      const fieldData = doc.fields?.updatedAt || doc.fields?.createdAt;
      const rawTime = fieldData?.timestampValue || fieldData?.integerValue;
      if (rawTime) {
        const dateStr = new Date(typeof rawTime === 'string' ? rawTime : parseInt(rawTime, 10)).toISOString();
        lastmodTag = `    <lastmod>${dateStr}</lastmod>\n`;
      }

      xmlContent += `  <url>\n    <loc>${baseUrl}/urun/${escapeHtml(slug)}-${escapeHtml(id)}</loc>\n${lastmodTag}    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    });
  }

  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400"
    },
  });
};
