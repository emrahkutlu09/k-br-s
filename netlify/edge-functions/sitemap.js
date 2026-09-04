export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const projectId = Netlify.env.get("FIREBASE_PROJECT_ID");
  
  if (!API_KEY || !projectId) {
    return new Response("Environment variables (FIREBASE_API_KEY or FIREBASE_PROJECT_ID) are missing.", { status: 500 });
  }

  // DÜZELTME: Sorgu doğrudan collection'a değil, parent document'a atılmalı (data)
  const aggUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/kibris-pazar/public/data:runAggregationQuery?key=${API_KEY}`;

  let totalProducts = 0;
  try {
    const res = await fetch(aggUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": baseUrl,
        "Referer": baseUrl + "/"
      },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId: "products" }] },
          aggregations: [{ count: {} }]
        }
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      // Firebase array veya object dönebilir, ikisini de kontrol et
      if (Array.isArray(data) && data[0]?.result?.aggregateFields?.count?.integerValue) {
        totalProducts = parseInt(data[0].result.aggregateFields.count.integerValue, 10);
      } else if (data.result?.aggregateFields?.count?.integerValue) {
        totalProducts = parseInt(data.result.aggregateFields.count.integerValue, 10);
      }
    } else {
      // 400 vs. hata olursa sistemi çökertme, varsayılan olarak 1000 ürün kabul et
      totalProducts = 1000; 
    }
  } catch (err) {
    // Sunucu bağlantı hatası olursa yine çökertme
    totalProducts = 1000;
  }

  const pageSize = 1000;
  const totalSitemaps = Math.max(1, Math.ceil(totalProducts / pageSize));

  let sitemapsXml = "";
  for (let i = 1; i <= totalSitemaps; i++) {
    sitemapsXml += `  <sitemap>\n    <loc>${baseUrl}/sitemap-products-${i}.xml</loc>\n  </sitemap>\n`;
  }

  sitemapsXml += `  <sitemap>\n    <loc>${baseUrl}/sitemap-stores.xml</loc>\n  </sitemap>\n`;
  sitemapsXml += `  <sitemap>\n    <loc>${baseUrl}/sitemap-categories.xml</loc>\n  </sitemap>\n`;

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapsXml}</sitemapindex>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400"
    },
  });
};
