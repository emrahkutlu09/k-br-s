export default async function(request, context) {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !projectId) {
    return new Response("Environment variables are missing.", { status: 500 });
  }

  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores`;

  const slugify = (text) => {
    if (!text) return "magaza";
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
        return new Response(`Firebase Stores Fetch Error: ${response.status}`, { status: 500 });
      }

      const data = await response.json();
      all.push(...(data.documents || []));
      token = data.nextPageToken || "";
    } while (token);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>${baseUrl}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>\n`;

    for (const doc of all) {
      const id = doc.name.split("/").pop();
      const name = doc.fields?.name?.stringValue || "magaza";
      const slug = slugify(name);
      let lastmod = "";
      const field = doc.fields?.updatedAt || doc.fields?.createdAt;
      const raw = field?.timestampValue || field?.integerValue;
      if (raw) {
        const d = new Date(typeof raw === "string" ? raw : parseInt(raw, 10));
        if (!Number.isNaN(d.getTime())) lastmod = `    <lastmod>${d.toISOString()}</lastmod>\n`;
      }
      xml += `  <url>\n    <loc>${baseUrl}/magaza/${xmlEscape(slug)}-${xmlEscape(id)}</loc>\n${lastmod}    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    xml += "</urlset>";

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    return new Response(`Internal Stores Error: ${error.message}`, { status: 500 });
  }
}
