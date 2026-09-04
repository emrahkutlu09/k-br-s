export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Sadece ürün, mağaza ve kategori sayfalarında çalış
  if (!path.startsWith('/urun/') && !path.startsWith('/magaza/') && !path.startsWith('/kategori/')) {
    return await context.next();
  }

  // --- KOTA KORUMASI: BOT TESPİTİ ---
  const userAgent = request.headers.get("user-agent") || "";
  // Google, Bing, Yandex, WhatsApp, Facebook, Twitter, Telegram vb. botları tanımla
  const isBot = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|whatsapp|viber|skype|telegram|discordbot/i.test(userAgent);

  // Eğer ziyaretçi gerçek bir insansa (tarayıcıysa), Firebase'e İSTEK ATMA!
  if (!isBot) {
    return await context.next();
  }
  // ----------------------------------

  try {
    const apiKey = Deno.env.get("FIREBASE_API_KEY");
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const appId = 'kibris-pazar';

    if (!apiKey || !projectId) {
      return await context.next();
    }

    let docPath = '';
    let isProduct = false;

    if (path.startsWith('/urun/')) {
      isProduct = true;
      const cleanPath = path.split('/urun/')[1].replace(/\/$/, '');
      const id = cleanPath.split('-').pop();
      if (!id) return await context.next();
      docPath = `artifacts/${appId}/public/data/products/${id}`;
    } else if (path.startsWith('/magaza/')) {
      const cleanPath = path.split('/magaza/')[1].replace(/\/$/, '');
      const id = cleanPath.split('-').pop();
      if (!id) return await context.next();
      docPath = `artifacts/${appId}/public/data/stores/${id}`;
    } else {
      // Kategori ise botlara standart başlık dön
      return await context.next();
    }

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}?key=${apiKey}`;
    
    const res = await fetch(firestoreUrl);
    
    if (!res.ok) {
      return await context.next();
    }

    const data = await res.json();
    const fields = data.fields || {};

    let title = "Kıbrıs Bazar | Hızlı ve Güvenli Alışveriş";
    let description = "Kuzey Kıbrıs'ın komisyonsuz dijital pazar yeri.";
    let image = "https://kibrisbazar.com/favicon.png";

    if (isProduct) {
      const pTitle = fields.title?.stringValue || "Ürün";
      const pPrice = fields.price?.integerValue || fields.price?.doubleValue || "";
      const storeName = fields.storeName?.stringValue || "Kıbrıs Bazar";
      title = `${pTitle} - ${storeName} | Kıbrıs Bazar`;
      description = fields.description?.stringValue ? fields.description.stringValue.substring(0, 160).replace(/\n/g, ' ') : `${pTitle} ürününü ${storeName} mağazasından inceleyin.`;
      
      const images = fields.images?.arrayValue?.values;
      if (images && images.length > 0) {
        image = images[0].stringValue || image;
      }
    } else {
      const sName = fields.name?.stringValue || "Mağaza";
      title = `${sName} Mağazası | Kıbrıs Bazar`;
      description = `${sName} mağazasının tüm ürünlerini inceleyin ve komisyonsuz alışveriş yapın.`;
      image = fields.logoUrl?.stringValue || fields.coverUrl?.stringValue || image;
    }

    const response = await context.next();
    const html = await response.text();

    const modifiedHtml = html
      .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
      .replace(/<meta name="description" content=".*?"/i, `<meta name="description" content="${description}"`)
      .replace(/<meta property="og:title" content=".*?"/i, `<meta property="og:title" content="${title}"`)
      .replace(/<meta property="og:description" content=".*?"/i, `<meta property="og:description" content="${description}"`)
      .replace(/<meta property="og:image" content=".*?"/i, `<meta property="og:image" content="${image}"`)
      .replace(/<meta name="twitter:title" content=".*?"/i, `<meta name="twitter:title" content="${title}"`)
      .replace(/<meta name="twitter:description" content=".*?"/i, `<meta name="twitter:description" content="${description}"`)
      .replace(/<meta name="twitter:image" content=".*?"/i, `<meta name="twitter:image" content="${image}"`);

    return new Response(modifiedHtml, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });

  } catch (err) {
    return await context.next();
  }
};
