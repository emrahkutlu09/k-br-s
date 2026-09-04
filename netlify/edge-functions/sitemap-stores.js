export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");
  
  if (!API_KEY || !projectId) {
    return new Response("Environment variables are missing.", { status: 500 });
  }

  const storesBaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores`;

  const slugify = (text) => {
    if (!text) return 'magaza';
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

  let allStores = [];
  let pageToken = "";

  try {
    do {
      // DÜZELTME: Sadece mağaza adını (name) ve tarihi getir
      let fetchUrl = `${storesBaseUrl}?pageSize=300&mask.fieldPaths=name&mask.fieldPaths=updatedAt&mask.fieldPaths=createdAt&key=${API_KEY}`;
      if (pageToken) fetchUrl += `&pageToken=${pageToken}`;

      const response = await fetch(fetchUrl, {
        headers: { "Origin": baseUrl, "Referer": baseUrl + "/" }
      });

      if (!response.ok) {
        return new Response(`Firebase Stores Fetch Error: ${response.status}`, { status: 500 });
      }

      const data = await response.json();
      if (data.documents) {
        allStores = allStores.concat(data.documents);
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);
  } catch (error) {
    return new Response(`Internal Stores Error: ${error.message}`, { status: 500 });
  }

  let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  xmlContent += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  allStores.forEach(doc => {
    const nameParts = doc.name.split('/');
    const id = nameParts[nameParts.length - 1];
    const nameStr = doc.fields?.name?.stringValue || "magaza";
    const slug = slugify(nameStr);

    let lastmodTag = "";
    const fieldData = doc.fields?.updatedAt || doc.fields?.createdAt;
    const rawTime = fieldData?.timestampValue || fieldData?.integerValue;
    if (rawTime) {
      const dateStr = new Date(typeof rawTime === 'string' ? rawTime : parseInt(rawTime, 10)).toISOString();
      lastmodTag = `    <lastmod>${dateStr}</lastmod>\n`;
    }

    xmlContent += `  <url>\n    <loc>${baseUrl}/magaza/${escapeHtml(slug)}-${escapeHtml(id)}</loc>\n${lastmodTag}    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  });

  xmlContent += `</urlset>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400"
    },
  });
};
