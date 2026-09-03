export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Sadece ürün ve mağaza sayfalarında çalış
  const isProduct = path.startsWith("/urun/");
  const isStore = path.startsWith("/magaza/");

  if (!isProduct && !isStore) {
    return await context.next();
  }

  // HTML içinde güvenli kullanım
  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // JSON-LD içinde güvenli kullanım
  const safeJsonLd = (obj) =>
    JSON.stringify(obj).replace(/</g, "\\u003c");

  const getField = (fields, name) => {
    const field = fields?.[name];
    if (!field) return "";

    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return field.integerValue;
    if (field.doubleValue !== undefined) return field.doubleValue;
    if (field.booleanValue !== undefined) return field.booleanValue;

    return "";
  };

  const getImages = (fields) => {
    const values = fields?.images?.arrayValue?.values || [];

    return values
      .map((item) => item?.stringValue)
      .filter(Boolean);
  };

  try {
    const apiKey = Deno.env.get("FIREBASE_API_KEY");
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");

    const appId = "kibris-pazar";

    if (!apiKey || !projectId) {
      return await context.next();
    }

    // URL'deki ID'yi al
    const cleanPath = path.replace(/\/$/, "");
    const lastPart = cleanPath.split("/").pop();

    if (!lastPart) {
      return await context.next();
    }

    // Örn:
    // 3-boyutlu-cicekli-canta-ntXurveq1pNYztRjE9Hh
    // Son "-" sonrası Firebase ID
    const id = lastPart.split("-").pop();

    if (!id) {
      return await context.next();
    }

    let docPath = "";

    if (isProduct) {
      docPath = `artifacts/${appId}/public/data/products/${id}`;
    }

    if (isStore) {
      docPath = `artifacts/${appId}/public/data/stores/${id}`;
    }

    const firestoreUrl =
      `https://firestore.googleapis.com/v1/projects/${projectId}` +
      `/databases/(default)/documents/${docPath}?key=${apiKey}`;

    const firebaseResponse = await fetch(firestoreUrl);

    // Ürün bulunamadıysa normal siteyi göster
    if (!firebaseResponse.ok) {
      const response = await context.next();

      const headers = new Headers(response.headers);
      headers.set("X-Kibris-SEO", "not-found");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    const data = await firebaseResponse.json();
    const fields = data.fields || {};

    /*
     * =========================
     * ÜRÜN SAYFASI
     * =========================
     */

    if (isProduct) {
      const productTitle =
        getField(fields, "title") || "Ürün";

      const description =
        getField(fields, "description") ||
        `${productTitle} ürününü Kıbrıs Bazar'da inceleyin.`;

      const price = getField(fields, "price");

      const storeName =
        getField(fields, "storeName") ||
        "Kıbrıs Bazar";

      const currency =
        getField(fields, "currency") ||
        "TRY";

      const images = getImages(fields);

      const canonicalUrl = url.origin + cleanPath;

      const title =
        `${productTitle} - ${storeName} | Kıbrıs Bazar`;

      const shortDescription =
        String(description)
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 160);

      /*
       * PRODUCT JSON-LD
       */

      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": productTitle,
        "description": description,
        "url": canonicalUrl
      };

      if (images.length > 0) {
        productSchema.image = images;
      }

      if (price !== "" && !isNaN(Number(price))) {
        productSchema.offers = {
          "@type": "Offer",
          "url": canonicalUrl,
          "priceCurrency": currency,
          "price": Number(price),
          "availability":
            "https://schema.org/InStock"
        };
      }

      /*
       * BREADCRUMB JSON-LD
       */

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Kıbrıs Bazar",
            "item": url.origin
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": productTitle,
            "item": canonicalUrl
          }
        ]
      };

      /*
       * ANA HTML'İ AL
       */

      const response = await context.next();
      const html = await response.text();

      /*
       * META ETİKETLERİ
       */

      let modifiedHtml = html;

      modifiedHtml = modifiedHtml.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(title)}</title>`
      );

      modifiedHtml = modifiedHtml.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${escapeHtml(shortDescription)}">`
      );

      modifiedHtml = modifiedHtml.replace(
        /<meta\s+property=["']og:title["'][^>]*>/i,
        `<meta property="og:title" content="${escapeHtml(title)}">`
      );

      modifiedHtml = modifiedHtml.replace(
        /<meta\s+property=["']og:description["'][^>]*>/i,
        `<meta property="og:description" content="${escapeHtml(shortDescription)}">`
      );

      if (images.length > 0) {
        modifiedHtml = modifiedHtml.replace(
          /<meta\s+property=["']og:image["'][^>]*>/i,
          `<meta property="og:image" content="${escapeHtml(images[0])}">`
        );
      }

      modifiedHtml = modifiedHtml.replace(
        /<meta\s+name=["']twitter:title["'][^>]*>/i,
        `<meta name="twitter:title" content="${escapeHtml(title)}">`
      );

      modifiedHtml = modifiedHtml.replace(
        /<meta\s+name=["']twitter:description["'][^>]*>/i,
        `<meta name="twitter:description" content="${escapeHtml(shortDescription)}">`
      );

      if (images.length > 0) {
        modifiedHtml = modifiedHtml.replace(
          /<meta\s+name=["']twitter:image["'][^>]*>/i,
          `<meta name="twitter:image" content="${escapeHtml(images[0])}">`
        );
      }

      /*
       * CANONICAL
       */

      const canonicalTag =
        `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`;

      if (/<link\s+rel=["']canonical["']/i.test(modifiedHtml)) {
        modifiedHtml = modifiedHtml.replace(
          /<link\s+rel=["']canonical["'][^>]*>/i,
          canonicalTag
        );
      } else {
        modifiedHtml = modifiedHtml.replace(
          /<\/head>/i,
          `${canonicalTag}\n</head>`
        );
      }

      /*
       * PRODUCT JSON-LD
       */

      modifiedHtml = modifiedHtml.replace(
        /<\/head>/i,
        `
<script type="application/ld+json">
${safeJsonLd(productSchema)}
</script>

<script type="application/ld+json">
${safeJsonLd(breadcrumbSchema)}
</script>

</head>`
      );

      /*
       * GOOGLE / AI TARAYICILARI İÇİN
       * GERÇEK ÜRÜN İÇERİĞİNİ HTML'E EKLE
       */

      const imageHtml =
        images.length > 0
          ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(productTitle)}" loading="eager">`
          : "";

      const priceHtml =
        price !== ""
          ? `<p><strong>Fiyat:</strong> ${escapeHtml(price)} ${escapeHtml(currency)}</p>`
          : "";

      const seoContent = `
<section id="seo-product-content">
  <h1>${escapeHtml(productTitle)}</h1>

  <p>${escapeHtml(description)}</p>

  ${priceHtml}

  <p>
    <strong>Mağaza:</strong>
    ${escapeHtml(storeName)}
  </p>

  ${imageHtml}
</section>
`;

      modifiedHtml = modifiedHtml.replace(
        /<body([^>]*)>/i,
        `<body$1>${seoContent}`
      );

      const headers = new Headers(response.headers);

      headers.set(
        "Content-Type",
        "text/html; charset=UTF-8"
      );

      // Test için
      headers.set("X-Kibris-SEO", "product-found");

      return new Response(modifiedHtml, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    /*
     * =========================
     * MAĞAZA SAYFASI
     * =========================
     */

    if (isStore) {
      const storeName =
        getField(fields, "name") ||
        "Mağaza";

      const logo =
        getField(fields, "logoUrl") ||
        getField(fields, "coverUrl") ||
        "";

      const canonicalUrl = url.origin + cleanPath;

      const title =
        `${storeName} Mağazası | Kıbrıs Bazar`;

      const description =
        `${storeName} mağazasındaki ürünleri Kıbrıs Bazar'da keşfedin.`;

      const storeSchema = {
        "@context": "https://schema.org",
        "@type": "Store",
        "name": storeName,
        "url": canonicalUrl
      };

      if (logo) {
        storeSchema.image = logo;
      }

      const response = await context.next();
      const html = await response.text();

      let modifiedHtml = html;

      modifiedHtml = modifiedHtml.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(title)}</title>`
      );

      modifiedHtml = modifiedHtml.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${escapeHtml(description)}">`
      );

      const canonicalTag =
        `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`;

      modifiedHtml = modifiedHtml.replace(
        /<\/head>/i,
        `
${canonicalTag}

<script type="application/ld+json">
${safeJsonLd(storeSchema)}
</script>

</head>`
      );

      const seoContent = `
<section id="seo-store-content">
  <h1>${escapeHtml(storeName)}</h1>
  <p>${escapeHtml(description)}</p>
</section>
`;

      modifiedHtml = modifiedHtml.replace(
        /<body([^>]*)>/i,
        `<body$1>${seoContent}`
      );

      const headers = new Headers(response.headers);

      headers.set(
        "Content-Type",
        "text/html; charset=UTF-8"
      );

      headers.set("X-Kibris-SEO", "store-found");

      return new Response(modifiedHtml, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return await context.next();

  } catch (error) {
    // Herhangi bir hata olursa siteyi bozma
    return await context.next();
  }
};