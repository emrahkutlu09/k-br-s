export default async function(request, context) {
  const url = new URL(request.url);
  const path = url.pathname;
  const baseUrl = url.origin; // https://kibrisbazar.com

  const isProduct = path.startsWith("/urun/");
  const isStore = path.startsWith("/magaza/");
  const isCategory = path.startsWith("/kategori/");

  if (!isProduct && !isStore && !isCategory) {
    return await context.next();
  }

  // 1. YENİLİK: Kendi tarayıcımızdan sonucu görebilmek için test parametresi ekledik
  const isTestMode = url.searchParams.has("seo-test");

  const userAgent = request.headers.get("user-agent") || "";
  // Yapay zeka botları (ChatGPT, Perplexity vb.) zaten burada yakalanıyor, harika!
  const isBot = /googlebot|google-inspectiontool|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|whatsapp|viber|skype|telegram|discordbot|linkedinbot|pinterest|chatgpt|openai|perplexity/i.test(userAgent);

  // Bot değilse ve test modunda da değilsek, hiç yorulmadan normal SPA'ya geç (SİSTEMİ BOZMA KURALI)
  if (!isBot && !isTestMode) return await context.next();

  // Netlify ortam değişkenlerini güvenli çağırma
  const API_KEY = Netlify.env.get("FIREBASE_API_KEY") || Deno.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("FIREBASE_PROJECT_ID");
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
      if (!id) return await context.next();

      docPath = isProduct
        ? `artifacts/${APP_ID}/public/data/products/${id}`
        : `artifacts/${APP_ID}/public/data/stores/${id}`;
    } else {
      categorySlug = path.split("/kategori/")[1]?.replace(/\/$/, "") || "";
      if (!categorySlug) return await context.next();
    }

    let data;

    if (isCategory) {
      const categoryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/categories?pageSize=300&key=${API_KEY}`;
      const res = await fetch(categoryUrl);
      if (!res.ok) return await context.next();
      data = await res.json();
    } else {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?key=${API_KEY}`;
      const res = await fetch(firestoreUrl);
      if (!res.ok) return await context.next();
      data = await res.json();
    }

    let title = "Kıbrıs Bazar | KKTC Online Alışveriş ve Dijital Pazaryeri";
    let description = "Kuzey Kıbrıs'ta online alışveriş için Kıbrıs Bazar. Yerel satıcılarla doğrudan iletişime geçin.";
    let image = "https://kibrisbazar.com/favicon.png";
    let jsonLd = "";
    let priceText = "";
    let storeNameContext = "Kıbrıs Bazar"; 

    if (isProduct) {
      const p = data.fields || {};
      const productTitle = p.title?.stringValue || "Ürün";
      const price = p.price?.doubleValue ?? p.price?.integerValue ?? null;
      const storeName = p.storeName?.stringValue || "Kıbrıs Bazar";
      const rawDescription = p.description?.stringValue || `${productTitle} ürününü Kuzey Kıbrıs'ın yerel pazaryeri Kıbrıs Bazar'da inceleyin.`;
      
      storeNameContext = storeName;
      title = `${productTitle} - ${storeName} | Kıbrıs Bazar KKTC`;
      description = rawDescription.substring(0, 160).replace(/\n/g, " ");

      const foundImage = p.images?.arrayValue?.values?.[0]?.stringValue || p.image?.stringValue || p.imageUrl?.stringValue || p.coverPhoto?.stringValue;
      if (foundImage) {
        image = foundImage.startsWith("http") ? foundImage : `${baseUrl}${foundImage.startsWith("/") ? "" : "/"}${foundImage}`;
      }

      priceText = price !== null ? `<p><strong>Fiyat:</strong> ${price} TL</p>` : "";

      // 4. YENİLİK: Product ve Breadcrumb Schema Birleştirildi (AI Botlar ve Google Alışveriş İçin Kusursuz Yapı)
      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": productTitle,
        "image": image ? [image] : undefined,
        "description": rawDescription,
        "sku": `KB-${id || '001'}`, // Benzersiz SKU oluşturumu
        "brand": { "@type": "Brand", "name": storeName },
        "offers": price !== null ? {
          "@type": "Offer",
          "url": url.href.split('?')[0],
          "priceCurrency": "TRY",
          "price": price,
          "availability": "https://schema.org/InStock",
          "seller": { "@type": "Organization", "name": storeName }
        } : undefined
      };

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Ana Sayfa", "item": baseUrl },
          { "@type": "ListItem", "position": 2, "name": "Mağazalar", "item": `${baseUrl}/magazalar` },
          { "@type": "ListItem", "position": 3, "name": productTitle, "item": url.href.split('?')[0] }
        ]
      };

      jsonLd = `
<script type="application/ld+json">${JSON.stringify(productSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`;

    } else if (isStore) {
      const s = data.fields || {};
      const name = s.name?.stringValue || "Mağaza";
      storeNameContext = name;
      title = `${name} | Girne - KKTC Online Mağaza | Kıbrıs Bazar`;
      description = `Kuzey Kıbrıs ${name} mağazasının ürünlerini inceleyin. Sıfır komisyonla yerel satıcıdan güvenle alışveriş yapın.`;

      const storeImage = s.logoUrl?.stringValue || s.coverUrl?.stringValue;
      if (storeImage) {
          image = storeImage.startsWith("http") ? storeImage : `${baseUrl}${storeImage.startsWith("/") ? "" : "/"}${storeImage}`;
      }

      jsonLd = `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": name,
        "url": url.href.split('?')[0],
        "logo": image,
        "address": { "@type": "PostalAddress", "addressRegion": "Kuzey Kıbrıs (KKTC)" }
      })}</script>`;
    } else {
       const docs = data.documents || [];
       const matched = docs.find(doc => doc.fields?.name?.stringValue?.toLowerCase().replace(/\s+/g, "-") === categorySlug);
       if (matched) {
         const name = matched.fields?.name?.stringValue || "Kategori";
         title = `${name} Ürünleri | KKTC Online Alışveriş | Kıbrıs Bazar`;
         description = `Kuzey Kıbrıs genelinde en uygun ${name} seçenekleri Kıbrıs Bazar'da. Satıcılarla anında iletişime geçin.`;
         jsonLd = `<script type="application/ld+json">${JSON.stringify({"@context": "https://schema.org", "@type": "CollectionPage", "name": `${name} Ürünleri`, "url": url.href.split('?')[0] })}</script>`;
       }
    }

    const response = await context.next();
    if (!response.ok) return response;

    let html = await response.text();

    html = html
      .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
      .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:(title|description|image|url|image:secure_url|type)["'][^>]*>/gi, "")
      .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "")
      .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
      .replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, ""); 

    const cleanUrl = escapeHtml(url.href.split('?')[0]);

    // 5. YENİLİK: Çoklu Dil SEO (Hreflang) Etiketleri
    const hreflangTags = `
<link rel="alternate" hreflang="tr-TR" href="${cleanUrl}">
<link rel="alternate" hreflang="en" href="${baseUrl}/en${path}">
<link rel="alternate" hreflang="ru" href="${baseUrl}/ru${path}">
<link rel="alternate" hreflang="el" href="${baseUrl}/el${path}">
<link rel="alternate" hreflang="ar" href="${baseUrl}/ar${path}">
<link rel="alternate" hreflang="x-default" href="${cleanUrl}">`;

    const tags = `
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${cleanUrl}">
${hreflangTags}
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:secure_url" content="${escapeHtml(image)}">
<meta property="og:type" content="${isProduct ? 'product' : 'website'}">
<meta property="og:url" content="${cleanUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
${jsonLd}`;

    html = html.replace(/<head[^>]*>/i, match => `${match}\n${tags}\n`);

    // 6. YENİLİK: AEO (Answer Engine Optimization) İçin Anlamsal (Semantic) İçerik
    // ChatGPT, Perplexity ve Google AI Overviews metinleri buradan çekecek!
    const semanticHtml = `
      <div id="seo-crawler-content" style="display:none;" aria-hidden="true">
        <h1>${escapeHtml(title)}</h1>
        <p><strong>Platform:</strong> Kıbrıs Bazar - Kuzey Kıbrıs'ın %0 Komisyonlu Yerel Dijital Pazaryeri</p>
        <p><strong>Lokasyon:</strong> Kuzey Kıbrıs, KKTC (Girne, Lefkoşa, Gazimağusa)</p>
        <p><strong>Satıcı:</strong> ${escapeHtml(storeNameContext)}</p>
        <p><strong>Açıklama:</strong> ${escapeHtml(description)}</p>
        ${priceText}
        <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />
        <p>Ürün veya mağaza ile doğrudan WhatsApp üzerinden iletişime geçebilirsiniz.</p>
      </div>
    `;
    
    html = html.replace('</body>', `${semanticHtml}\n</body>`);

    return new Response(html, {
      status: response.status,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    console.error("SEO Bot Error:", error);
    return await context.next(); 
  }
}
