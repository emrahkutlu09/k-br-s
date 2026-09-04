export default async function(request, context) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ---------------------------------------------------------
  // SADECE SEO SAYFALARINDA ÇALIŞ
  // ---------------------------------------------------------
  const isProduct = path.startsWith("/urun/");
  const isStore = path.startsWith("/magaza/");
  const isCategory = path.startsWith("/kategori/");

  if (!isProduct && !isStore && !isCategory) {
    return context.next();
  }

  // ---------------------------------------------------------
  // SADECE GET / HEAD İSTEKLERİ
  // ---------------------------------------------------------
  if (request.method !== "GET" && request.method !== "HEAD") {
    return context.next();
  }

  // ---------------------------------------------------------
  // NORMAL KULLANICIYI AYIR
  //
  // Netlify-Agent-Category:
  // ai-agent
  // crawler
  // browser
  // tooling
  // other
  //
  // Ayrıca UA üzerinden geniş kapsamlı ikinci kontrol vardır.
  // ---------------------------------------------------------
  const agentCategory =
    request.headers.get("netlify-agent-category") ||
    request.headers.get("Netlify-Agent-Category") ||
    "";

  const userAgent =
    request.headers.get("user-agent") ||
    "";

  const ua = userAgent.toLowerCase();

  const categoryIsBot =
    /(^|;)(ai-agent|crawler)(;|$)/i.test(agentCategory);

  const knownCrawlerPattern =
    /bot|crawler|spider|slurp|fetcher|archiver|preview|facebookexternalhit|whatsapp|telegram|discord|linkedin|pinterest|twitter|slack|google|bing|yandex|baidu|duckduckgo|applebot|gptbot|chatgpt|openai|claudebot|anthropic|perplexity|bytespider|amazonbot|ccbot|semrush|ahrefs|mj12bot|petalbot|seznambot|uptimerobot/i;

  const uaIsBot = knownCrawlerPattern.test(ua);

  const isBot = categoryIsBot || uaIsBot;

  // ---------------------------------------------------------
  // NORMAL ZİYARETÇİ:
  // HİÇBİR FIREBASE SORGUSU YAPMA
  // ---------------------------------------------------------
  if (!isBot) {
    return context.next();
  }

  // ---------------------------------------------------------
  // ENVIRONMENT VARIABLES
  // ---------------------------------------------------------
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return context.next();
  }

  const APP_ID = "kibris-pazar";

  // ---------------------------------------------------------
  // SLUGIFY
  // ---------------------------------------------------------
  const slugify = (text) => {
    if (!text) return "";

    return String(text)
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  // ---------------------------------------------------------
  // HTML ESCAPE
  // ---------------------------------------------------------
  const escapeHtml = (value) => {
    if (value === undefined || value === null) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // ---------------------------------------------------------
  // JSON-LD GÜVENLİ JSON
  // ---------------------------------------------------------
  const safeJson = (value) => {
    return JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
  };

  // ---------------------------------------------------------
  // URL'DEN ID ÇIKAR
  //
  // ÖRNEK:
  // /urun/eyfel-montessori-ranza-xRTPJwvfLzS5vdUrx4BL
  //
  // ID:
  // xRTPJwvfLzS5vdUrx4BL
  // ---------------------------------------------------------
  let type = "";
  let id = "";

  if (isProduct) {

    type = "products";

    const cleanPath = decodeURIComponent(
      path.replace("/urun/", "").replace(/\/$/, "")
    );

    const parts = cleanPath.split("-");

    if (parts.length < 2) {
      return context.next();
    }

    id = parts[parts.length - 1];

  } else if (isStore) {

    type = "stores";

    const cleanPath = decodeURIComponent(
      path.replace("/magaza/", "").replace(/\/$/, "")
    );

    const parts = cleanPath.split("-");

    if (parts.length < 2) {
      return context.next();
    }

    id = parts[parts.length - 1];

  } else if (isCategory) {

    type = "categories";

    id = decodeURIComponent(
      path
        .replace("/kategori/", "")
        .replace(/\/$/, "")
    );
  }

  if (!type || !id) {
    return context.next();
  }

  // ---------------------------------------------------------
  // FIRESTORE
  // ---------------------------------------------------------
  let data = null;

  try {

    // =======================================================
    // KATEGORİ
    // =======================================================
    if (type === "categories") {

      const categoriesBaseUrl =
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
        `/databases/(default)/documents/artifacts/${APP_ID}` +
        `/public/data/categories`;

      let pageToken = "";

      while (true) {

        let fetchUrl =
          `${categoriesBaseUrl}` +
          `?pageSize=300` +
          `&mask.fieldPaths=name` +
          `&key=${encodeURIComponent(API_KEY)}`;

        if (pageToken) {
          fetchUrl +=
            `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const response = await fetch(fetchUrl, {
          headers: {
            "Accept": "application/json"
          }
        });

        // ---------------------------------------------------
        // FIREBASE KOTA KORUMASI
        // ---------------------------------------------------
        if (response.status === 429) {

          return new Response(
            "Firebase Daily Quota Exceeded",
            {
              status: 503,
              headers: {
                "Retry-After": "86400",
                "Content-Type": "text/plain; charset=UTF-8",
                "Cache-Control": "no-store"
              }
            }
          );
        }

        if (!response.ok) {
          return context.next();
        }

        const result = await response.json();

        const documents =
          result.documents || [];

        for (const document of documents) {

          const categoryName =
            document.fields?.name?.stringValue || "";

          if (
            slugify(categoryName) ===
            slugify(id)
          ) {
            data = document;
            break;
          }
        }

        if (data) {
          break;
        }

        pageToken =
          result.nextPageToken || "";

        if (!pageToken) {
          break;
        }
      }

    // =======================================================
    // ÜRÜN / MAĞAZA
    // =======================================================
    } else {

      const firestoreUrl =
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
        `/databases/(default)/documents/artifacts/${APP_ID}` +
        `/public/data/${type}/${encodeURIComponent(id)}` +
        `?key=${encodeURIComponent(API_KEY)}`;

      const response = await fetch(
        firestoreUrl,
        {
          headers: {
            "Accept": "application/json"
          }
        }
      );

      // ---------------------------------------------------
      // FIREBASE KOTA KORUMASI
      // ---------------------------------------------------
      if (response.status === 429) {

        return new Response(
          "Firebase Daily Quota Exceeded",
          {
            status: 503,
            headers: {
              "Retry-After": "86400",
              "Content-Type": "text/plain; charset=UTF-8",
              "Cache-Control": "no-store"
            }
          }
        );
      }

      // ---------------------------------------------------
      // ÜRÜN / MAĞAZA YOK
      // ---------------------------------------------------
      if (response.status === 404) {

        return new Response(
          "Not Found",
          {
            status: 404,
            headers: {
              "Content-Type": "text/plain; charset=UTF-8",
              "Cache-Control": "public, max-age=300"
            }
          }
        );
      }

      if (!response.ok) {
        return context.next();
      }

      data = await response.json();
    }

  } catch (error) {

    return context.next();
  }

  // ---------------------------------------------------------
  // FIRESTORE DATA YOKSA
  // ---------------------------------------------------------
  if (!data || !data.fields) {

    return new Response(
      "Not Found",
      {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "Cache-Control": "public, max-age=300"
        }
      }
    );
  }

  const fields = data.fields;

  // ---------------------------------------------------------
  // DEFAULT SEO
  // ---------------------------------------------------------
  let title =
    "Kıbrıs Bazar | Kuzey Kıbrıs Dijital Pazaryeri";

  let description =
    "Kuzey Kıbrıs'ın yeni nesil dijital pazaryeri.";

  let image =
    "https://kibrisbazar.com/favicon.png";

  let jsonLd = "";

  // =========================================================
  // ÜRÜN
  // =========================================================
  if (type === "products") {

    const productTitle =
      fields.title?.stringValue ||
      "Ürün";

    const rawDescription =
      fields.description?.stringValue ||
      "";

    const price =
      fields.price?.doubleValue ??
      fields.price?.integerValue ??
      fields.price?.stringValue ??
      "";

    const storeName =
      fields.storeName?.stringValue ||
      "Kıbrıs Bazar";

    const brand =
      fields.brand?.stringValue ||
      storeName;

    title =
      `${productTitle} - ${storeName} | Kıbrıs Bazar`;

    description =
      rawDescription
        ? rawDescription
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 160)
        : `${productTitle} ürününü ${storeName} mağazasından inceleyin.`;

    const images =
      fields.images?.arrayValue?.values || [];

    if (images.length > 0) {

      const firstImage =
        images[0]?.stringValue;

      if (firstImage) {
        image = firstImage;
      }
    }

    const productSchema = {

      "@context":
        "https://schema.org",

      "@type":
        "Product",

      "name":
        productTitle,

      "image":
        image ? [image] : [],

      "description":
        description,

      "sku":
        id,

      "brand": {
        "@type":
          "Brand",

        "name":
          brand
      },

      "seller": {
        "@type":
          "Organization",

        "name":
          storeName
      },

      "offers": {
        "@type":
          "Offer",

        "url":
          url.href,

        "priceCurrency":
          "TRY",

        "price":
          String(price),

        "availability":
          "https://schema.org/InStock"
      }
    };

    jsonLd =
      `<script type="application/ld+json">` +
      `${safeJson(productSchema)}` +
      `</script>`;

  // =========================================================
  // MAĞAZA
  // =========================================================
  } else if (type === "stores") {

    const storeName =
      fields.name?.stringValue ||
      "Mağaza";

    const district =
      fields.district?.stringValue ||
      "Kuzey Kıbrıs";

    title =
      `${storeName} Mağazası | Kıbrıs Bazar`;

    description =
      `${district} bölgesindeki ${storeName} mağazasının ürünlerini keşfedin.`;

    image =
      fields.logoUrl?.stringValue ||
      fields.coverUrl?.stringValue ||
      image;

    const storeSchema = {

      "@context":
        "https://schema.org",

      "@type":
        "Organization",

      "name":
        storeName,

      "url":
        url.href,

      "logo":
        image
    };

    jsonLd =
      `<script type="application/ld+json">` +
      `${safeJson(storeSchema)}` +
      `</script>`;

  // =========================================================
  // KATEGORİ
  // =========================================================
  } else if (type === "categories") {

    const categoryName =
      fields.name?.stringValue ||
      "Kategori";

    title =
      `${categoryName} Ürünleri | Kıbrıs Bazar`;

    description =
      `Kuzey Kıbrıs genelinde ${categoryName} ürünlerini Kıbrıs Bazar'da keşfedin.`;

    const categorySchema = {

      "@context":
        "https://schema.org",

      "@type":
        "CollectionPage",

      "name":
        `${categoryName} Ürünleri`,

      "url":
        url.href
    };

    jsonLd =
      `<script type="application/ld+json">` +
      `${safeJson(categorySchema)}` +
      `</script>`;
  }

  // ---------------------------------------------------------
  // INDEX.HTML'İ AL
  // ---------------------------------------------------------
  let response;

  try {

    response =
      await context.next();

  } catch (error) {

    return new Response(
      "Origin Error",
      {
        status: 502,
        headers: {
          "Content-Type":
            "text/plain; charset=UTF-8"
        }
      }
    );
  }

  if (!response.ok) {
    return response;
  }

  let html =
    await response.text();

  // ---------------------------------------------------------
  // ESKİ SEO ETİKETLERİNİ TEMİZLE
  // ---------------------------------------------------------
  html = html
    .replace(
      /<title[\s\S]*?<\/title>/gi,
      ""
    )

    .replace(
      /<meta\s+name=["']description["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+property=["']og:title["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+property=["']og:description["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+property=["']og:image["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+property=["']og:url["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+name=["']twitter:card["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+name=["']twitter:title["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+name=["']twitter:description["'][^>]*>/gi,
      ""
    )

    .replace(
      /<meta\s+name=["']twitter:image["'][^>]*>/gi,
      ""
    )

    .replace(
      /<link\s+rel=["']canonical["'][^>]*>/gi,
      ""
    )

    .replace(
      /<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi,
      ""
    );

  // ---------------------------------------------------------
  // YENİ SEO ETİKETLERİ
  // ---------------------------------------------------------
  const seoHead = `
<title>${escapeHtml(title)}</title>

<meta
  name="description"
  content="${escapeHtml(description)}"
>

<link
  rel="canonical"
  href="${escapeHtml(url.href)}"
>

<meta
  property="og:type"
  content="${isProduct ? "product" : "website"}"
>

<meta
  property="og:title"
  content="${escapeHtml(title)}"
>

<meta
  property="og:description"
  content="${escapeHtml(description)}"
>

<meta
  property="og:image"
  content="${escapeHtml(image)}"
>

<meta
  property="og:url"
  content="${escapeHtml(url.href)}"
>

<meta
  name="twitter:card"
  content="summary_large_image"
>

<meta
  name="twitter:title"
  content="${escapeHtml(title)}"
>

<meta
  name="twitter:description"
  content="${escapeHtml(description)}"
>

<meta
  name="twitter:image"
  content="${escapeHtml(image)}"
>

${jsonLd}
`;

  // ---------------------------------------------------------
  // HEAD'E EKLE
  // ---------------------------------------------------------
  html =
    html.replace(
      /<head>/i,
      `<head>${seoHead}`
    );

  // ---------------------------------------------------------
  // SEO BOT RESPONSE
  // ---------------------------------------------------------
  return new Response(
    html,
    {
      status: response.status,

      headers: {
        "Content-Type":
          "text/html; charset=UTF-8",

        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",

        "X-SEO-Rendered":
          "true",

        "X-SEO-Type":
          type
      }
    }
  );
}
