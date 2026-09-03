export default async (request, context) => {
  const BASE_URL = "https://kibrisbazar.com";
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return new Response(
      "Server Configuration Error",
      {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  const aggregationUrl =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}` +
    `/databases/(default)/documents:runAggregationQuery?key=${encodeURIComponent(API_KEY)}`;

  let totalProducts = 0;

  try {
    const response = await fetch(aggregationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: {
            from: [
              {
                collectionId: "products"
              }
            ],
            allDescendants: true
          },
          aggregations: [
            {
              alias: "total",
              count: {}
            }
          ]
        }
      })
    });

    if (!response.ok) {
      return new Response(
        `Firebase Aggregation Error: ${response.status}`,
        {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store"
          }
        }
      );
    }

    const result = await response.json();

    const aggregateFields =
      result?.[0]?.result?.aggregateFields ||
      result?.result?.aggregateFields;

    const countValue =
      aggregateFields?.total?.integerValue ||
      aggregateFields?.count?.integerValue;

    if (countValue === undefined) {
      return new Response(
        "Firebase Aggregation Error: Count result missing",
        {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store"
          }
        }
      );
    }

    totalProducts = Number.parseInt(countValue, 10);

    if (!Number.isFinite(totalProducts) || totalProducts < 0) {
      return new Response(
        "Firebase Aggregation Error: Invalid count",
        {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store"
          }
        }
      );
    }
  } catch (error) {
    return new Response(
      "Firebase Aggregation Connection Error",
      {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  const PRODUCTS_PER_SITEMAP = 1000;

  const totalProductSitemaps =
    Math.ceil(totalProducts / PRODUCTS_PER_SITEMAP);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (let page = 1; page <= totalProductSitemaps; page++) {
    xml += `  <sitemap>\n`;
    xml += `    <loc>${BASE_URL}/sitemap-products-${page}.xml</loc>\n`;
    xml += `  </sitemap>\n`;
  }

  xml += `  <sitemap>\n`;
  xml += `    <loc>${BASE_URL}/sitemap-stores.xml</loc>\n`;
  xml += `  </sitemap>\n`;

  xml += `  <sitemap>\n`;
  xml += `    <loc>${BASE_URL}/sitemap-categories.xml</loc>\n`;
  xml += `  </sitemap>\n`;

  xml += `</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control":
        "public, max-age=43200, stale-while-revalidate=86400"
    }
  });
};
