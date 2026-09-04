export default async function(request, context) {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !projectId) {
    return new Response("Environment variables are missing.", { status: 500 });
  }

  const aggUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/kibris-pazar/public/data/products:runAggregationQuery?key=${API_KEY}`;

  let totalProducts = 5000; // Güvenli Fallback (Eğer kota doluyse sistem çökmez, varsayılan 5000 ürün kabul eder)

  try {
    const res = await fetch(aggUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId: "products" }] },
          aggregations: [{ count: {} }]
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      totalProducts = parseInt(
        data.result?.aggregateFields?.count?.integerValue || "5000",
        10
      );
    }
  } catch (error) {
    console.warn("Sitemap sayım isteği kota nedeniyle atlandı, fallback kullanılıyor:", error.message);
  }

  const pageSize = 1000;
  const totalSitemaps = Math.ceil(totalProducts / pageSize) || 1;

  let sitemapsXml = "";
  for (let i = 1; i <= totalSitemaps; i++) {
    sitemapsXml += `  <sitemap><loc>${baseUrl}/sitemap-products-${i}.xml</loc></sitemap>\n`;
  }

  sitemapsXml += `  <sitemap><loc>${baseUrl}/sitemap-stores.xml</loc></sitemap>\n`;
  sitemapsXml += `  <sitemap><loc>${baseUrl}/sitemap-categories.xml</loc></sitemap>\n`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapsXml}</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=172800"
    }
  });
}
