export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-products.xml</loc>
  </sitemap>
</sitemapindex>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
};
