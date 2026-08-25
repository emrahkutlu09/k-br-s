export default async (request, context) => {
  const url = new URL(request.url);

  // Sadece /urun/ ile başlayan linklerde çalışsın
  if (!url.pathname.startsWith('/urun/')) {
    return context.next();
  }

  // Orijinal index.html'i al
  const response = await context.next();
  let html = await response.text();

  // URL'den ID'yi al (örnek: /urun/sari-koltuk-IDBURADA)
  const pathParts = url.pathname.split('-');
  const productId = pathParts[pathParts.length - 1];

  // Eğer geçerli bir ID yoksa orijinal HTML'i yolla
  if (!productId || productId === 'urun') {
    return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  // Firebase'den Ürün Bilgisini REST API ile Çek
  const FIREBASE_PROJECT_ID = "kibris-6b4f7";
  const apiUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/kibris-pazar/public/data/products/${productId}`;

  try {
    const apiRes = await fetch(apiUrl);
    const data = await apiRes.json();

    // Ürün bulunursa meta etiketlerini değiştir
    if (data && data.fields) {
      const title = data.fields.title?.stringValue || "Kıbrıs Bazar Ürünü";
      const desc = data.fields.description?.stringValue || "Kıbrıs Bazar'da binlerce ürün. Hemen sipariş verin.";
      
      // Resim array'inden ilkini al (eğer varsa)
      let imageUrl = "https://placehold.co/1200x630/0f172a/f97316?text=KIBRIS+BAZAR";
      if (data.fields.images && data.fields.images.arrayValue && data.fields.images.arrayValue.values && data.fields.images.arrayValue.values.length > 0) {
          imageUrl = data.fields.images.arrayValue.values[0].stringValue;
      }

      const seoTags = `
        <title>${title} | Kıbrıs Bazar</title>
        <meta name="description" content="${desc}">
        <meta property="og:title" content="${title} | Kıbrıs Bazar">
        <meta property="og:description" content="${desc}">
        <meta property="og:image" content="${imageUrl}">
        <meta name="twitter:title" content="${title} | Kıbrıs Bazar">
        <meta name="twitter:description" content="${desc}">
        <meta name="twitter:image" content="${imageUrl}">
      `;

      // Html içindeki mevcut <head> etiketinden sonra bizimkileri ekle
      html = html.replace('<head>', `<head>\n${seoTags}`);
    }
  } catch (error) {
    console.error("SEO Bot Hatasi:", error);
  }

  // Modifiye edilmiş HTML'i kullanıcıya/bota gönder
  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
};
