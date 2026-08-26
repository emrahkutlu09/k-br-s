export default async (request, context) => {
  const baseUrl = "https://kibrisbazar.com";
  
  let sitemaps = "";
  for (let i = 1; i <= 10; i++) {
    sitemaps += `  <sitemap>\n    <loc>${baseUrl}/sitemap-products-${i}.xml</loc>\n  </sitemap>\n`;
  }

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}</sitemapindex>`;

  return new Response(xmlContent, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
};