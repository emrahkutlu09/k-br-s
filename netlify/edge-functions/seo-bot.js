export default async function(request, context) {
  const url = new URL(request.url);
  const path = url.pathname;

  const isProduct = path.startsWith("/urun/");
  const isStore = path.startsWith("/magaza/");
  const isCategory = path.startsWith("/kategori/");

  if (!isProduct && !isStore && !isCategory) {
    return context.next();
  }

  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return new Response("Server Configuration Error", { status: 500 });
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isBot = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|whatsapp|viber|skype|telegram|discordbot|linkedinbot|pinterest/i.test(userAgent);

  if (!isBot) {
    return context.next();
  }

  const APP_ID = "kibris-pazar";

  const slugify = (text) => {
    if (!text) return "urun";
    return text.toString().toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/\s+/g, "-").replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
  };

  const escapeHtml = (value) => {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  const escapeJson = (value) => {
    return JSON.stringify(value)
      .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  };

  let type = "";
  let id = "";

  if (isProduct) {
    type = "products";
    const clean = path.replace("/urun/", "").replace(/\/$/, "");
    const parts = clean.split("-");
    if (parts.length < 2) return context.next();
    id = parts[parts.length - 1];
  } else if (isStore) {
    type = "stores";
    const clean = path.replace("/magaza/", "").replace(/\/$/, "");
    const parts = clean.split("-");
    if (parts.length < 2) return context.next();
    id = parts[parts.length - 1];
  } else if (isCategory) {
    type = "categories";
    id = decodeURIComponent(path.replace("/kategori/", "").replace(/\/$/, ""));
  }

  let data = null;

  try {
    if (type === "categories") {
      const collectionUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/categories?pageSize=300&key=${API_KEY}`;
      let pageToken = "";

      while (true) {
        let fetchUrl = collectionUrl;
        if (pageToken) fetchUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

        const response = await fetch(fetchUrl);

        if (!response.ok) {
          if (response.status === 429) {
            return new Response("Firebase Daily Quota Exceeded (429). Please try again tomorrow.", {
              status: 503,
              headers: { "Retry-After": "86400", "Content-Type": "text/plain" }
            });
          }
          return context.next();
        }

        const result = await response.json();
        const documents = result.documents || [];

        for (const document of documents) {
          const categoryName = document.fields?.name?.stringValue || "";
          if (slugify(categoryName) === id) {
            data = document;
            break;
          }
        }

        if (data) break;

        pageToken = result.nextPageToken || "";
        if (!pageToken) break;
      }
    } else {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/${type}/${encodeURIComponent(id)}?key=${API_KEY}`;
      const response = await fetch(firestoreUrl);

      if (!response.ok) {
        if (response.status === 429) {
          return new Response("Firebase Daily Quota Exceeded (429). Please try again tomorrow.", {
            status: 503,
            headers: { "Retry-After": "86400", "Content-Type": "text/plain" }
          });
        }

        if (response.status === 404) {
          return new Response("Not Found", { status: 404 });
        }

        return context.next();
      }

      data = await response.json();
    }
  } catch (error) {
    return context.next();
  }

  if (!data || !data.fields) {
    return new Response("Not Found", { status: 404 });
  }

  const fields = data.fields;
  let title = "Kıbrıs Bazar";
  let description = "Kuzey Kıbrıs dijital pazaryeri.";
  let image = "https://kibrisbazar.com/favicon.png";
  let jsonLd = "";

  if (type === "products") {
    const productTitle = fields.title?.stringValue || "Ürün";
    const descriptionRaw = fields.description?.stringValue || "";
    const price = fields.price?.doubleValue ?? fields.price?.integerValue ?? fields.price?.stringValue ?? "";
    const storeName = fields.storeName?.stringValue || "Kıbrıs Bazar";

    title = `${productTitle} - ${storeName} | Kıbrıs Bazar`;
    description = descriptionRaw
      ? descriptionRaw.substring(0, 160).replace(/\s+/g, " ")
      : `${productTitle} ürününü ${storeName} mağazasından inceleyin.`;

    const images = fields.images?.arrayValue?.values || [];
    if (images.length > 0) image = images[0]?.stringValue || image;

    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": productTitle,
      "image": image ? [image] : [],
      "description": description,
      "sku": id,
      "offers": {
        "@type": "Offer",
        "url": url.href,
        "priceCurrency": "TRY",
        "price": String(price),
        "availability": "https://schema.org/InStock"
      }
    };

    jsonLd = `<script type="application/ld+json">${escapeJson(productSchema)}</script>`;

  } else if (type === "stores") {
    const storeName = fields.name?.stringValue || "Mağaza";
    const district = fields.district?.stringValue || "Kuzey Kıbrıs";

    title = `${storeName} Mağazası | Kıbrıs Bazar`;
    description = `${district} bölgesindeki ${storeName} mağazasının ürünlerini keşfedin.`;
    image = fields.logoUrl?.stringValue || fields.coverUrl?.stringValue || image;

    const storeSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": storeName,
      "url": url.href,
      "logo": image
    };

    jsonLd = `<script type="application/ld+json">${escapeJson(storeSchema)}</script>`;

  } else if (type === "categories") {
    const categoryName = fields.name?.stringValue || "Kategori";

    title = `${categoryName} Ürünleri | Kıbrıs Bazar`;
    description = `Kuzey Kıbrıs genelinde ${categoryName} ürünlerini Kıbrıs Bazar'da keşfedin.`;

    const categorySchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `${categoryName} Ürünleri`,
      "url": url.href
    };

    jsonLd = `<script type="application/ld+json">${escapeJson(categorySchema)}</script>`;
  }

  const response = await context.next();
  if (!response.ok) return response;

  let html = await response.text();

  html = html
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:image["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:url["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:image["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");

  html = html.replace(
    /<head>/i,
    `<head>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url.href)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(url.href)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
${jsonLd}`
  );

  return new Response(html, {
    status: response.status,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
