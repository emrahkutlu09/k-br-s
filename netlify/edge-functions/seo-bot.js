export default async function(request, context) {
  const url = new URL(request.url);
  const path = url.pathname;

  const isProduct = path.startsWith("/urun/");
  const isStore = path.startsWith("/magaza/");
  const isCategory = path.startsWith("/kategori/");

  if (!isProduct && !isStore && !isCategory) {
    return context.next();
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isBot = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|whatsapp|viber|skype|telegram|discordbot|linkedinbot|pinterest|chatgpt|openai/i.test(userAgent);

  if (!isBot) return context.next();

  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");
  const APP_ID = "kibris-pazar";

  if (!API_KEY || !PROJECT_ID) {
    return new Response("Server Configuration Error", { status: 500 });
  }

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  try {
    let docPath = "";
    let categorySlug = "";

    if (isProduct || isStore) {
      const clean = path.split("/").filter(Boolean).pop() || "";
      const id = clean.split("-").pop();
      if (!id) return new Response("Not Found", { status: 404 });

      docPath = isProduct
        ? `artifacts/${APP_ID}/public/data/products/${id}`
        : `artifacts/${APP_ID}/public/data/stores/${id}`;
    } else {
      categorySlug = path.split("/kategori/")[1]?.replace(/\/$/, "") || "";
      if (!categorySlug) return new Response("Not Found", { status: 404 });
    }

    let data;

    if (isCategory) {
      const categoryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/categories?pageSize=300&key=${API_KEY}`;
      const res = await fetch(categoryUrl);
      if (!res.ok) return new Response("Not Found", { status: res.status === 404 ? 404 : 500 });

      data = await res.json();
    } else {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${API_KEY}`;
      const res = await fetch(firestoreUrl);

      if (res.status === 404) return new Response("Not Found", { status: 404 });
      if (res.status === 429) {
        return new Response("Temporary service unavailable.", {
          status: 503,
          headers: { "Retry-After": "86400", "Content-Type": "text/plain; charset=utf-8" }
        });
      }
      if (!res.ok) return new Response("Firebase Upstream Error", { status: 500 });

      data = await res.json();
    }

    let title = "Kıbrıs Bazar";
    let description = "Kuzey Kıbrıs dijital pazar yeri.";
    let image = "https://kibrisbazar.com/favicon.png";
    let jsonLd = "";

    if (isProduct) {
      const p = data.fields || {};
      const productTitle = p.title?.stringValue || "Ürün";
      const price = p.price?.doubleValue ?? p.price?.integerValue ?? null;
      const storeName = p.storeName?.stringValue || "Kıbrıs Bazar";
      const rawDescription = p.description?.stringValue || `${productTitle} ürününü inceleyin.`;

      title = `${productTitle} - ${storeName} | Kıbrıs Bazar`;
      description = rawDescription.substring(0, 160).replace(/\n/g, " ");

      // Resim yakalama mekanizmasını güçlendirdik (Farklı isimlerle kaydedilmiş olsa bile bulur)
      const foundImage = p.images?.arrayValue?.values?.[0]?.stringValue || 
                         p.image?.stringValue || 
                         p.imageUrl?.stringValue || 
                         p.coverPhoto?.stringValue;

      if (foundImage) {
        // Resim linkinin tam (https://...) olduğundan emin oluyoruz
        image = foundImage.startsWith("http") ? foundImage : `https://kibrisbazar.com${foundImage.startsWith("/") ? "" : "/"}${foundImage}`;
      }

      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: productTitle,
        image: image ? [image] : undefined,
        description: rawDescription,
        brand: { "@type": "Brand", name: storeName },
        offers: price !== null ? {
          "@type": "Offer",
          url: url.href,
          priceCurrency: "TRY",
          price: price,
          availability: "https://schema.org/InStock"
        } : undefined
      };

      jsonLd = `<script type="application/ld+json">${JSON.stringify(productSchema)}</script>`;
    } else if (isStore) {
      const s = data.fields || {};
      const name = s.name?.stringValue || "Mağaza";
      title = `${name} Mağazası | Kıbrıs Bazar`;
      description = `${name} mağazasının ürünlerini inceleyin.`;
      
      const storeImage = s.logoUrl?.stringValue || s.coverUrl?.stringValue;
      if (storeImage) {
          image = storeImage.startsWith("http") ? storeImage : `https://kibrisbazar.com${storeImage.startsWith("/") ? "" : "/"}${storeImage}`;
      }

      jsonLd = `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name,
        url: url.href,
        logo: image
      })}</script>`;
    } else {
      const slugify = (text) => {
        if (!text) return "urun";
        return text.toString().toLowerCase()
          .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
          .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
          .replace(/\s+/g, "-").replace(/[^\w\-]+/g, "")
          .replace(/\-\-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
      };

      const docs = data.documents || [];
      const matched = docs.find(doc => slugify(doc.fields?.name?.stringValue || "") === categorySlug);
      if (!matched) return new Response("Not Found", { status: 404 });

      const name = matched.fields?.name?.stringValue || "Kategori";
      title = `${name} Ürünleri | Kıbrıs Bazar`;
      description = `Kuzey Kıbrıs genelinde ${name} seçenekleri Kıbrıs Bazar'da.`;

      jsonLd = `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${name} Ürünleri`,
        url: url.href
      })}</script>`;
    }

    const response = await context.next();
    if (!response.ok) return response;

    let html = await response.text();

    html = html
      .replace(/<title>[\s\S]*?<\/title>/gi, "")
      .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:(title|description|image|url|image:secure_url)["'][^>]*>/gi, "")
      .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "")
      .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");

    const tags = `
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url.href)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:secure_url" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(url.href)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
${jsonLd}`;

    html = html.replace(/<head[^>]*>/i, match => `${match}\n${tags}\n`);

    return new Response(html, {
      status: response.status,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    return new Response("Edge Bot Internal Error", { status: 500 });
  }
}
