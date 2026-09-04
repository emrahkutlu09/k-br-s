export default async function(request, context) {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return new Response("Missing Firebase Environment Variables", { status: 500 });
  }

  const categoriesUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/artifacts/kibris-pazar/public/data/categories`;

  const slugify = (text) => {
    if (!text) return "kategori";

    return text.toString().toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  const xmlEscape = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  let pageToken = "";
  let categories = [];

  try {
    do {
      let fetchUrl =
        `${categoriesUrl}?pageSize=300` +
        `&mask.fieldPaths=name` +
        `&key=${API_KEY}`;

      if (pageToken) {
        fetchUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const response = await fetch(fetchUrl);

      if (!response.ok) {
        if (response.status === 429) {
          return new Response("Firebase Daily Quota Exceeded", {
            status: 503,
            headers: {
              "Retry-After": "86400",
              "Content-Type": "text/plain"
            }
          });
        }

        return new Response(
          `Firebase Categories Error: ${response.status}`,
          { status: 500 }
        );
      }

      const data = await response.json();

      if (data.documents) {
        categories.push(...data.documents);
      }

      pageToken = data.nextPageToken || "";

    } while (pageToken);

  } catch (error) {
    return new Response("Categories Sitemap Error", { status: 500 });
  }

  const uniqueSlugs = new Set();

  let xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const doc of categories) {
    const name = doc.fields?.name?.stringValue || "";
    const slug = slugify(name);

    if (!slug || uniqueSlugs.has(slug)) continue;

    uniqueSlugs.add(slug);

    xml +=
      `  <url>\n` +
      `    <loc>${baseUrl}/kategori/${xmlEscape(slug)}</loc>\n` +
      `    <changefreq>weekly</changefreq>\n` +
      `    <priority>0.8</priority>\n` +
      `  </url>\n`;
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=172800"
    }
  });
}
