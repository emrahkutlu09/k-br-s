export default async function(request, context) {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return new Response("Missing Firebase Environment Variables", { status: 500 });
  }

  const match = new URL(request.url).pathname.match(/^\/sitemap-products-(\d+)\.xml$/);

  if (!match) {
    return new Response("Not Found", { status: 404 });
  }

  const targetPage = parseInt(match[1], 10);

  if (!Number.isInteger(targetPage) || targetPage < 1) {
    return new Response("Not Found", { status: 404 });
  }

  const pageSize = 1000;

  const productsUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/artifacts/kibris-pazar/public/data/products`;

  const slugify = (text) => {
    if (!text) return "urun";

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
  let documents = [];

  try {
    for (let page = 1; page <= targetPage; page++) {
      let fetchUrl =
        `${productsUrl}?pageSize=${pageSize}` +
        `&mask.fieldPaths=title` +
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
          `Firebase Products Error: ${response.status}`,
          { status: 500 }
        );
      }

      const data = await response.json();

      if (page === targetPage) {
        documents = data.documents || [];
        break;
      }

      pageToken = data.nextPageToken || "";

      if (!pageToken) {
        return new Response("Not Found", { status: 404 });
      }
    }

  } catch (error) {
    return new Response("Products Sitemap Error", { status: 500 });
  }

  let xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const doc of documents) {
    const name = doc.name || "";
    const id = name.split("/").pop();

    if (!id) continue;

    const title = doc.fields?.title?.stringValue || "urun";
    const slug = slugify(title);
    const lastmod = getLastMod(doc.fields);

    xml +=
      `  <url>\n` +
      `    <loc>${baseUrl}/urun/${xmlEscape(slug)}-${xmlEscape(id)}</loc>\n`;

    if (lastmod) {
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
    }

    xml +=
      `    <changefreq>daily</changefreq>\n` +
      `    <priority>0.9</priority>\n` +
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
