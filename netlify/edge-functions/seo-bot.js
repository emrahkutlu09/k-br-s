export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const isProduct = path.startsWith('/urun/');
  const isStore = path.startsWith('/magaza/');
  const isCategory = path.startsWith('/kategori/');

  if (!isProduct && !isStore && !isCategory) {
    return context.next();
  }

  const response = await context.next();
  let html = await response.text();

  const API_KEY = Netlify.env.get("FIREBASE_API_KEY");
  const PROJECT_ID = Netlify.env.get("FIREBASE_PROJECT_ID");

  if (!API_KEY || !PROJECT_ID) {
    return new Response("Server Configuration Error: Missing Environment Variables", { status: 500 });
  }

  const pathParts = path.split('-');
  const targetId = pathParts[pathParts.length - 1];
  const categorySlug = isCategory ? path.split('/kategori/')[1] : null;

  if ((isProduct || isStore) && (!targetId || targetId === 'urun' || targetId === 'magaza')) {
    return new Response("Not Found", { status: 404 });
  }
  if (isCategory && !categorySlug) {
    return new Response("Not Found", { status: 404 });
  }

  const slugify = (text) => {
    if (!text) return 'urun';
    return text.toString().toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  let apiUrl = "";
  if (isProduct) {
    apiUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/kibris-pazar/public/data/products/${targetId}?key=${API_KEY}`;
  } else if (isStore) {
    apiUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/kibris-pazar/public/data/stores/${targetId}?key=${API_KEY}`;
  } else if (isCategory) {
    apiUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/artifacts/kibris-pazar/public/data/categories?pageSize=300&key=${API_KEY}`;
  }

  try {
    const apiRes = await fetch(apiUrl, {
      headers: { "Origin": "https://kibrisbazar.com", "Referer": "https://kibrisbazar.com/" }
    });

    if (apiRes.status === 404) {
      return new Response("Not Found", { status: 404 });
    }
    if (!apiRes.ok) {
      return new Response(`Firebase Upstream Error: ${apiRes.status}`, { status: 500 });
    }

    const data = await apiRes.json();
    let title = "", desc = "", imageUrl = "", jsonLdSchema = "", seoTextHtml = "";

    if (isProduct) {
      if (!data || !data.fields) return new Response("Not Found", { status: 404 });
      const p = data.fields;
      const rawTitle = p.title?.stringValue || "Ürün";
      const price = p.price?.doubleValue || p.price?.integerValue || "0";
      const storeName = p.storeName?.stringValue || "Kıbrıs Bazar";
      
      title = `${rawTitle} - ${storeName} | Kıbrıs Bazar`;
      desc = `${price} TL - ${p.description?.stringValue ? p.description.stringValue.substring(0, 150) : rawTitle}`;
      imageUrl = (p.images?.arrayValue?.values?.length > 0) ? p.images.arrayValue.values[0].stringValue : "https://placehold.co/1200x630/0f172a/f97316?text=KIBRIS+BAZAR";

      const productSchemaObj = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": rawTitle,
        "image": imageUrl,
        "description": desc,
        "offers": {
          "@type": "Offer",
          "url": url.href,
          "priceCurrency": "TRY",
          "price": price,
          "availability": "https://schema.org/InStock",
          "seller": { "@type": "Organization", "name": storeName }
        }
      };
      jsonLdSchema = `<script type="application/ld+json">${JSON.stringify(productSchemaObj)}</script>`;
      seoTextHtml = `<main id="mainContent"><h1>${escapeHtml(rawTitle)}</h1><p>${escapeHtml(desc)}</p><p>Fiyat: ${price} TL</p></main>`;

    } else if (isStore) {
      if (!data || !data.fields) return new Response("Not Found", { status: 404 });
      const s = data.fields;
      const rawName = s.name?.stringValue || "Mağaza";
      
      title = `${rawName} Mağazası | Kıbrıs Bazar`;
      desc = `${s.district?.stringValue || 'Kıbrıs'} bölgesindeki ${rawName} ürünlerini keşfedin.`;
      imageUrl = s.logoUrl?.stringValue || "https://placehold.co/1200x630/0f172a/f97316?text=MAGAZA";

      const orgSchemaObj = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": rawName,
        "url": url.href,
        "logo": imageUrl
      };
      jsonLdSchema = `<script type="application/ld+json">${JSON.stringify(orgSchemaObj)}</script>`;
      seoTextHtml = `<main id="mainContent"><h1>${escapeHtml(rawName)} Mağazası</h1><p>${escapeHtml(desc)}</p></main>`;

    } else if (isCategory) {
      const docs = data.documents || [];
      let matchedCategory = null;

      for (const doc of docs) {
        const catName = doc.fields?.name?.stringValue || "";
        if (slugify(catName) === categorySlug) {
          matchedCategory = catName;
          break;
        }
      }

      if (!matchedCategory) {
        return new Response("Not Found", { status: 404 });
      }

      title = `${matchedCategory} Ürünleri | Kıbrıs Bazar`;
      desc = `Kuzey Kıbrıs genelinde en uygun ${matchedCategory} seçenekleri Kıbrıs Bazar'da.`;
      imageUrl = "https://placehold.co/1200x630/0f172a/f97316?text=KIBRIS+BAZAR";

      const collectionSchemaObj = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": `${matchedCategory} Ürünleri`,
        "url": url.href
      };
      jsonLdSchema = `<script type="application/ld+json">${JSON.stringify(collectionSchemaObj)}</script>`;
      seoTextHtml = `<main id="mainContent"><h1>${escapeHtml(matchedCategory)} Kategorisi</h1><p>${escapeHtml(desc)}</p></main>`;
    }

    html = html.replace(/<title>[\s\S]*?<\/title>/gi, '');
    html = html.replace(/<meta\s+name="description"[^>]*>/gi, '');
    html = html.replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '');
    html = html.replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '');
    html = html.replace(/<link\s+rel="canonical"[^>]*>/gi, '');

    const seoTags = `
      <title>${escapeHtml(title)}</title>
      <meta name="description" content="${escapeHtml(desc)}">
      <link rel="canonical" href="${escapeHtml(url.href)}">
      <meta property="og:title" content="${escapeHtml(title)}">
      <meta property="og:description" content="${escapeHtml(desc)}">
      <meta property="og:image" content="${escapeHtml(imageUrl)}">
      <meta property="og:url" content="${escapeHtml(url.href)}">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${escapeHtml(title)}">
      <meta name="twitter:description" content="${escapeHtml(desc)}">
      <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
      ${jsonLdSchema}
    `;

    html = html.replace('<head>', `<head>\n${seoTags}`);

    if (seoTextHtml) {
      html = html.replace(/<main id="mainContent"[\s\S]*?<\/main>/gi, seoTextHtml);
    }

  } catch (error) {
    return new Response(`Edge Bot Internal Error: ${error.message}`, { status: 500 });
  }

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
};
