export default async function(request, context) {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !projectId) {
    return new Response("Environment variables are missing.", { status: 500 });
  }

  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/kibris-pazar/public/data/categories`;

  const slugify = (text) => {
    if (!text) return "kategori";
    return text.toString().toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/\s+/g, "-").replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
  };

  const xmlEscape = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  let all = [];
  let token = "";

  try {
    do {
      let fetchUrl = `${base}?pageSize=300&key=${API_KEY}`;
      if (token) fetchUrl += `&pageToken=${encodeURIComponent(token)}`;

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        return new Response(`Firebase Categories Fetch Error: ${response.status}`, { status: 500 });
      }

      const data = await response.json();
      all.push(...(data.documents || []));
      token = data.nextPageToken || "";
    } while (token);

    const unique = new Set();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const doc of all) {
      const name = doc.fields?.name?.stringValue || "";
      const slug = slugify(name);
      if (slug && !unique.has(slug)) {
        unique.add(slug);
        xml += `  <url><loc>${baseUrl}/kategori/${xmlEscape(slug)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      }
    }

    xml += "</urlset>";

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    return new Response(`Internal Categories Error: ${error.message}`, { status: 500 });
  }
}
