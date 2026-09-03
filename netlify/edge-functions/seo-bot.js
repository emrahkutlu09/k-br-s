export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Sadece ürün ve mağaza sayfalarında SEO işlemini çalıştır
  if (!path.startsWith('/urun/') && !path.startsWith('/magaza/')) {
    return await context.next();
  }

  try {
    // ESki çalışan kodla aynı Firebase bağlantısı
    const apiKey = Deno.env.get("FIREBASE_API_KEY");
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const appId = 'kibris-pazar';

    if (!apiKey || !projectId) {
      return await context.next();
    }

    let docPath = '';
    let isProduct = false;

    // ------------------------------------------
    // ÜRÜN
    // ------------------------------------------
    if (path.startsWith('/urun/')) {
      isProduct = true;

      const cleanPath = path
        .split('/urun/')[1]
        .replace(/\/$/, '');

      // URL'nin sonundaki ID'yi al
      const id = cleanPath.split('-').pop();

      if (!id) {
        return await context.next();
      }

      docPath = `artifacts/${appId}/public/data/products/${id}`;

    // ------------------------------------------
    // MAĞAZA
    // ------------------------------------------
    } else if (path.startsWith('/magaza/')) {

      const cleanPath = path
        .split('/magaza/')[1]
        .replace(/\/$/, '');

      const id = cleanPath.split('-').pop();

      if (!id) {
        return await context.next();
      }

      docPath = `artifacts/${appId}/public/data/stores/${id}`;
    }

    // ------------------------------------------
    // FIRESTORE
    // ------------------------------------------

    const firestoreUrl =
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}?key=${apiKey}`;

    const res = await fetch(firestoreUrl);

    // Firebase hata verirse normal siteyi göster
    if (!res.ok) {
      return await context.next();
    }

    const data = await res.json();
    const fields = data.fields || {};

    // ------------------------------------------
    // YARDIMCI FONKSİYONLAR
    // ------------------------------------------

    const getString = (field) => {
      return field?.stringValue || '';
    };

    const getNumber = (field) => {
      if (field?.integerValue !== undefined) {
        return Number(field.integerValue);
      }

      if (field?.doubleValue !== undefined) {
        return Number(field.doubleValue);
      }

      return null;
    };

    const getImages = (field) => {
      const values = field?.arrayValue?.values || [];

      return values
        .map(item => item?.stringValue)
        .filter(Boolean);
    };

    // HTML içinde güvenli kullanım
    const escapeHtml = (value) => {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // JSON-LD için güvenli JSON
    const safeJson = (value) => {
      return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
    };

    // ------------------------------------------
    // VARSAYILAN SEO BİLGİLERİ
    // ------------------------------------------

    let title = "Kıbrıs Bazar | Hızlı ve Güvenli Alışveriş";
    let description =
      "Kuzey Kıbrıs'ın komisyonsuz dijital pazar yeri.";

    let image = "https://kibrisbazar.com/favicon.png";

    let canonicalUrl = url.origin + path;

    let seoContent = '';
    let jsonLd = [];

    // ==========================================
    // ÜRÜN SEO
    // ==========================================

    if (isProduct) {

      const pTitle =
        getString(fields.title) || "Ürün";

      const pDescription =
        getString(fields.description);

      const price =
        getNumber(fields.price);

      const storeName =
        getString(fields.storeName) || "Kıbrıs Bazar";

      const currency =
        getString(fields.currency) || "TRY";

      const images =
        getImages(fields.images);

      if (images.length > 0) {
        image = images[0];
      }

      // ----------------------------------------
      // TITLE
      // ----------------------------------------

      title =
        `${pTitle} - ${storeName} | Kıbrıs Bazar`;

      // ----------------------------------------
      // DESCRIPTION
      // ----------------------------------------

      description =
        pDescription
          ? pDescription
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 160)
          : `${pTitle} ürününü ${storeName} mağazasından Kıbrıs Bazar'da inceleyin.`;

      // ----------------------------------------
      // CANONICAL
      // ----------------------------------------

      canonicalUrl =
        `https://kibrisbazar.com${path}`;

      // ----------------------------------------
      // GOOGLE PRODUCT STRUCTURED DATA
      // ----------------------------------------

      const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",

        "name": pTitle,

        "description":
          pDescription || description,

        "image":
          images.length > 0 ? images : [image],

        "url":
          canonicalUrl,

        "brand": {
          "@type": "Brand",
          "name": storeName
        },

        "offers": {
          "@type": "Offer",
          "url": canonicalUrl,
          "priceCurrency": currency,
          "price": price !== null ? price : "",
          "availability":
            "https://schema.org/InStock",

          "seller": {
            "@type": "Organization",
            "name": storeName
          }
        }
      };

      // ----------------------------------------
      // BREADCRUMB SCHEMA
      // ----------------------------------------

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",

        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Kıbrıs Bazar",
            "item": "https://kibrisbazar.com/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": pTitle,
            "item": canonicalUrl
          }
        ]
      };

      jsonLd.push(productSchema);
      jsonLd.push(breadcrumbSchema);

      // ----------------------------------------
      // HTML İÇİ ÜRÜN İÇERİĞİ
      // ----------------------------------------

      seoContent = `
<section id="seo-product-content"
  style="position:absolute;
  left:-10000px;
  top:auto;
  width:1px;
  height:1px;
  overflow:hidden;">

  <h1>${escapeHtml(pTitle)}</h1>

  <p>
    ${escapeHtml(
      pDescription ||
      `${pTitle} ürününü ${storeName} mağazasından Kıbrıs Bazar'da inceleyin.`
    )}
  </p>

  ${
    price !== null
      ? `<p>Fiyat: ${escapeHtml(price)} ${escapeHtml(currency)}</p>`
      : ''
  }

  <p>Mağaza: ${escapeHtml(storeName)}</p>

  ${
    image
      ? `<img src="${escapeHtml(image)}"
          alt="${escapeHtml(pTitle)}"
          width="800"
          height="800">`
      : ''
  }

</section>
`;

    // ==========================================
    // MAĞAZA SEO
    // ==========================================

    } else {

      const sName =
        getString(fields.name) || "Mağaza";

      const logo =
        getString(fields.logoUrl);

      const cover =
        getString(fields.coverUrl);

      title =
        `${sName} Mağazası | Kıbrıs Bazar`;

      description =
        `${sName} mağazasının ürünlerini Kıbrıs Bazar'da inceleyin ve güvenli alışveriş yapın.`;

      image =
        logo ||
        cover ||
        image;

      canonicalUrl =
        `https://kibrisbazar.com${path}`;

      // ----------------------------------------
      // MAĞAZA SCHEMA
      // ----------------------------------------

      const storeSchema = {
        "@context": "https://schema.org",
        "@type": "Store",

        "name": sName,

        "url":
          canonicalUrl,

        "image":
          image,

        "description":
          description
      };

      jsonLd.push(storeSchema);

      // ----------------------------------------
      // MAĞAZA HTML
      // ----------------------------------------

      seoContent = `
<section id="seo-store-content"
  style="position:absolute;
  left:-10000px;
  top:auto;
  width:1px;
  height:1px;
  overflow:hidden;">

  <h1>${escapeHtml(sName)} Mağazası</h1>

  <p>
    ${escapeHtml(description)}
  </p>

  ${
    image
      ? `<img src="${escapeHtml(image)}"
          alt="${escapeHtml(sName)} mağazası"
          width="800"
          height="600">`
      : ''
  }

</section>
`;
    }

    // ------------------------------------------
    // ORİJİNAL HTML'İ AL
    // ------------------------------------------

    const response = await context.next();

    const html = await response.text();

    // ------------------------------------------
    // META ETİKETLERİNİ GÜNCELLE
    // ------------------------------------------

    let modifiedHtml = html;

    modifiedHtml = modifiedHtml
      .replace(
        /<title>.*?<\/title>/i,
        `<title>${escapeHtml(title)}</title>`
      )

      .replace(
        /<meta name="description" content=".*?"/i,
        `<meta name="description" content="${escapeHtml(description)}"`
      )

      .replace(
        /<meta property="og:title" content=".*?"/i,
        `<meta property="og:title" content="${escapeHtml(title)}"`
      )

      .replace(
        /<meta property="og:description" content=".*?"/i,
        `<meta property="og:description" content="${escapeHtml(description)}"`
      )

      .replace(
        /<meta property="og:image" content=".*?"/i,
        `<meta property="og:image" content="${escapeHtml(image)}"`
      )

      .replace(
        /<meta property="og:url" content=".*?"/i,
        `<meta property="og:url" content="${escapeHtml(canonicalUrl)}"`
      )

      .replace(
        /<meta name="twitter:title" content=".*?"/i,
        `<meta name="twitter:title" content="${escapeHtml(title)}"`
      )

      .replace(
        /<meta name="twitter:description" content=".*?"/i,
        `<meta name="twitter:description" content="${escapeHtml(description)}"`
      )

      .replace(
        /<meta name="twitter:image" content=".*?"/i,
        `<meta name="twitter:image" content="${escapeHtml(image)}"`
      );

    // ------------------------------------------
    // CANONICAL EKLE
    // ------------------------------------------

    if (/<link[^>]+rel=["']canonical["']/i.test(modifiedHtml)) {

      modifiedHtml = modifiedHtml.replace(
        /<link[^>]+rel=["']canonical["'][^>]*>/i,
        `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`
      );

    } else {

      modifiedHtml = modifiedHtml.replace(
        /<\/head>/i,
        `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
</head>`
      );
    }

    // ------------------------------------------
    // PRODUCT / STORE JSON-LD EKLE
    // ------------------------------------------

    const jsonLdHtml = jsonLd
      .map(schema => {
        return `
<script type="application/ld+json">
${safeJson(schema)}
</script>`;
      })
      .join('\n');

    modifiedHtml = modifiedHtml.replace(
      /<\/head>/i,
      `${jsonLdHtml}
</head>`
    );

    // ------------------------------------------
    // ÜRÜN / MAĞAZA İÇERİĞİNİ BODY'YE EKLE
    // ------------------------------------------

    modifiedHtml = modifiedHtml.replace(
      /<body([^>]*)>/i,
      `<body$1>
${seoContent}`
    );

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    const headers = new Headers(response.headers);

    // Debug / kontrol için
    headers.set(
      "X-Kibris-SEO",
      isProduct ? "product-found" : "store-found"
    );

    headers.set(
      "X-Robots-Tag",
      "index, follow"
    );

    return new Response(modifiedHtml, {
      headers,
      status: response.status,
      statusText: response.statusText
    });

  } catch (err) {

    // Herhangi bir hata olursa siteyi bozma
    return await context.next();
  }
};