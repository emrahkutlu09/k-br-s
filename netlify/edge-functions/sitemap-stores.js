export default async function(request, context) {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return new Response("Missing Firebase Environment Variables", { status: 500 });
  }

  const storesUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores`;

  const slugify = (text) => {
    if (!text) return "magaza";

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

  const getLastMod = (fields) => {
    const field = fields?.updatedAt || fields?.createdAt;

    if (!field) return null;

    if (field.timestampValue) {
      const date = new Date(field.timestampValue);

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    if (field.integerValue) {
      const value = Number(field.integerValue);

      if (Number.isFinite(value)) {
        const milliseconds =
          value < 100000000000 ? value * 1000 : value;

        const date = new Date(milliseconds);

        if (!Number.isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }

    return null;
  };

  let pageToken = "";
  let stores = [];

  try {
    do {
      let fetchUrl =
        `${storesUrl}?pageSize=300` +
        `&mask.fieldPaths=name` +
        `&mask.fieldPaths=updatedAt` +
        `&mask.fieldPaths=createdAt` +
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
          `Firebase Stores Error: ${response.status}`,
          { status: 500 }
        );
      }

      const data = await response.json();

      if (data.documents) {
        stores.push(...data.documents);
      }

      pageToken = data.nextPageToken || "";

    } while (pageToken);

  } catch (error) {
    return new Response("Stores Sitemap Error", { status: 500 });
  }

  let xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  xml +=
    `  <url>\n` +
    `    <loc>${baseUrl}/</loc>\n` +
    `    <changefreq>hourly</changefreq>\n` +
    `    <priority>1.0</priority>\n` +
    `  </url>\n`;

  for (const doc of stores) {
    const id = doc.name?.split("/").pop();

    if (!id) continue;

    const name = doc.fields?.name?.stringValue;

    if (!name) continue;

    const slug = slugify(name);
    const lastmod = getLastMod(doc.fields);

    xml +=
      `  <url>\n` +
      `    <loc>${baseUrl}/magaza/${xmlEscape(slug)}-${xmlEscape(id)}</loc>\n`;

    if (lastmod) {
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
    }

    xml +=
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
