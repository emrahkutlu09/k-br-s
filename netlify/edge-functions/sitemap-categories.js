export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");
  
  if (!API_KEY || !projectId) {
    return new Response("Environment variables are missing.", { status: 500 });
  }

  const categoriesBaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/kibris-pazar/public/data/categories`;

  const slugify = (text) => {
    if (!text) return 'kategori';
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

  let allCategories = [];
  let pageToken = "";

  try {
    do {
      let fetchUrl = `${categoriesBaseUrl}?pageSize=300&key=${API_KEY}`;
      if (pageToken) fetchUrl += `&pageToken=${pageToken}`;

      const response = await fetch(fetchUrl, {
        headers: { "Origin": baseUrl, "Referer": baseUrl + "/" }
      });

      if (!response.ok) {
        return new Response(`Firebase Categories Fetch Error: ${response.status}`, { status: 500 });
      }

      const data = await response.json();
      if (data.documents) {
        allCategories = allCategories.concat(data.documents);
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);
  } catch (error) {
    return new Response(`Internal Categories Error: ${error.message}`, { status: 500 });
  }

  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  const uniqueSlugs = new Set();

  allCategories.forEach(doc => {
    const nameStr = doc.fields?.name?.stringValue || "";
    const slug = slugify(nameStr);
    
    if (slug && !uniqueSlugs.has(slug)) {
      uniqueSlugs.add(slug);
      xmlContent += `  <url>\n    <loc>${baseUrl}/kategori/${escapeHtml(slug)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }
  });

  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400"
    },
  });
};
