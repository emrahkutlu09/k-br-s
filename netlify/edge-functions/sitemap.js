export default async function(request, context) {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return new Response("Environment variables are missing.", { status: 500 });
  }

  const aggUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/kibris-pazar/public/data/products:runAggregationQuery?key=${API_KEY}`;

  let totalProducts = 0;

  try {
    const res = await fetch(aggUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": baseUrl,
        "Referer": `${baseUrl}/`
      },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: {
            from: [{ collectionId: "products" }]
          },
          aggregations: [{ count: {} }]
        }
      })
    });

    if (!res.ok) {
      return new Response(`Firebase Aggregation Error: ${res.status}`, { status: 500 });
    }

    const data = await res.json();
    totalProducts = parseInt(
      data.result?.aggregateFields?.count?.integerValue || "0",
      10
    );

  } catch (err) {
    return new Response(`Server Connection Error: ${err.message}`, { status: 500 });
  }

  const pageSize = 1000;
  const totalSitemaps = Math.ceil(totalProducts / pageSize);

  let sitemapsXml = "";

  for (let i = 1; i <= totalSitemaps; i++) {
    sitemapsXml += `  <sitemap>
    <loc>${baseUrl}/sitemap-products-${i}.xml</loc>
  </sitemap>
`;
  }

  sitemapsXml += `  <sitemap>
    <loc>${baseUrl}/sitemap-stores.xml</loc>
  </sitemap>
`;

  sitemapsXml += `  <sitemap>
    <loc>${baseUrl}/sitemap-categories.xml</loc>
  </sitemap>
`;

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapsXml}</sitemapindex>`;

  return new Response(xmlContent, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400"
    }
  });
}
