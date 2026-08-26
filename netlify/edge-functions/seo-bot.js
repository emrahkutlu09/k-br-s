export default async (request, context) => {
  const url = new URL(request.url);

  const isProduct = url.pathname.startsWith('/urun/');
  const isStore = url.pathname.startsWith('/magaza/');

  if (!isProduct && !isStore) {
    return context.next();
  }

  const response = await context.next();
  let html = await response.text();

  const pathParts = url.pathname.split('-');
  const targetId = pathParts[pathParts.length - 1];

  if (!targetId || targetId === 'urun' || targetId === 'magaza') {
    return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  const FIREBASE_PROJECT_ID = "kibris-6b4f7";
  const collectionName = isProduct ? "products" : "stores";
  const apiUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/kibris-pazar/public/data/${collectionName}/${targetId}`;

  try {
    const apiRes = await fetch(apiUrl);
    const data = await apiRes.json();

    if (data && data.fields) {
      let title, desc, imageUrl, jsonLdSchema = "";

      if (isProduct) {
        title = data.fields.title?.stringValue || "Kıbrıs Bazar Ürünü";
        const price = data.fields.price?.doubleValue || data.fields.price?.integerValue || "0";
        desc = `${price} TL - ${data.fields.description?.stringValue || "Kıbrıs Bazar'da hemen sipariş verin."}`;
        
        imageUrl = "https://placehold.co/1200x630/0f172a/f97316?text=KIBRIS+BAZAR";
        if (data.fields.images && data.fields.images.arrayValue?.values?.length > 0) {
            imageUrl = data.fields.images.arrayValue.values[0].stringValue;
        }

        jsonLdSchema = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": "${title}",
          "image": "${imageUrl}",
          "description": "${desc.replace(/"/g, '&quot;')}",
          "offers": {
            "@type": "Offer",
            "url": "${url.href}",
            "priceCurrency": "TRY",
            "price": "${price}",
            "availability": "https://schema.org/InStock",
            "seller": {
              "@type": "Organization",
              "name": "${data.fields.storeName?.stringValue || 'Kıbrıs Bazar'}"
            }
          }
        }
        </script>`;

      } else {
        title = `${data.fields.name?.stringValue} Mağazası`;
        desc = `${data.fields.district?.stringValue} bölgesindeki ${title} ürünlerini Kıbrıs Bazar'da keşfedin.`;
        imageUrl = data.fields.logoUrl?.stringValue || "https://placehold.co/1200x630/0f172a/f97316?text=MAGAZA";
      }

      html = html.replace(/<link rel="canonical" href="[^"]+">/g, '');
      html = html.replace(/<meta property="og:url" content="[^"]+">/g, '');

      const seoTags = `
        <title>${title} | Kıbrıs Bazar</title>
        <meta name="description" content="${desc}">
        <link rel="canonical" href="${url.href}">
        <meta property="og:title" content="${title} | Kıbrıs Bazar">
        <meta property="og:description" content="${desc}">
        <meta property="og:image" content="${imageUrl}">
        <meta property="og:url" content="${url.href}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${title} | Kıbrıs Bazar">
        <meta name="twitter:description" content="${desc}">
        <meta name="twitter:image" content="${imageUrl}">
        ${jsonLdSchema}
      `;

      html = html.replace('<head>', `<head>\n${seoTags}`);
    }
  } catch (error) {
    console.error("SEO Bot Hatasi:", error);
  }

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
};
