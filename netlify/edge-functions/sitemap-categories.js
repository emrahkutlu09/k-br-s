export default async function handler(request, context) {
  const baseUrl = "https://kibrisbazar.com";

  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !projectId) {
    return new Response(
      "Environment variables are missing.",
      { status: 500 }
    );
  }

  const categoriesUrl =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/artifacts/kibris-pazar` +
    `/public/data/categories?key=${API_KEY}&pageSize=300`;

  const slugify = (text) => {
    if (!text) return "kategori";

    return text
      .toString()
      .toLowerCase()
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

  try {
    const response = await fetch(categoriesUrl, {
      headers: {
        "Origin": baseUrl,
        "Referer": `${baseUrl}/`
      }
    });

    if (!response.ok) {
      return new Response(
        `Firebase Categories Error: ${response.status}`,
        { status: 500 }
      );
    }

    const data = await response.json();
    const documents = data.documents || [];

    const uniqueSlugs = new Set();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const doc of documents) {
      const name = doc.fields?.name?.stringValue || "";
      const slug = slugify(name);

      if (!slug || uniqueSlugs.has(slug)) {
        continue;
      }

      uniqueSlugs.add(slug);

      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/kategori/${slug}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control":
          "public, max-age=43200, stale-while-revalidate=86400"
      }
    });

  } catch (error) {
    return new Response(
      `Internal Categories Error: ${error.message}`,
      { status: 500 }
    );
  }
}
