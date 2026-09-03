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

  const storesBaseUrl =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/artifacts/kibris-pazar` +
    `/public/data/stores`;

  const slugify = (text) => {
    if (!text) return "magaza";

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

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/</loc>\n`;
  xml += `    <changefreq>hourly</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  let pageToken = "";

  try {
    do {
      let fetchUrl =
        `${storesBaseUrl}?pageSize=300&key=${API_KEY}`;

      if (pageToken) {
        fetchUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const response = await fetch(fetchUrl, {
        headers: {
          "Origin": baseUrl,
          "Referer": `${baseUrl}/`
        }
      });

      if (!response.ok) {
        return new Response(
          `Firebase Stores Fetch Error: ${response.status}`,
          { status: 500 }
        );
      }

      const data = await response.json();
      const documents = data.documents || [];

      for (const doc of documents) {
        const nameParts = doc.name.split("/");
        const id = nameParts[nameParts.length - 1];

        const name =
          doc.fields?.name?.stringValue || "";

        if (!name || !id) {
          continue;
        }

        const slug = slugify(name);

        let lastmodTag = "";

        const fieldData =
          doc.fields?.updatedAt ||
          doc.fields?.createdAt;

        const rawTime =
          fieldData?.timestampValue ||
          fieldData?.integerValue;

        if (rawTime) {
          const date =
            new Date(
              typeof rawTime === "string"
                ? rawTime
                : parseInt(rawTime, 10)
            );

          if (!Number.isNaN(date.getTime())) {
            lastmodTag =
              `    <lastmod>${date.toISOString()}</lastmod>\n`;
          }
        }

        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/magaza/${slug}-${id}</loc>\n`;

        if (lastmodTag) {
          xml += lastmodTag;
        }

        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }

      pageToken = data.nextPageToken || "";

    } while (pageToken);

  } catch (error) {
    return new Response(
      `Internal Stores Error: ${error.message}`,
      { status: 500 }
    );
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
}
