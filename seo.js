(function() {
    // 1. Mevcut sayfanın temiz URL'sini alıyoruz
    const currentUrl = window.location.href.split('?')[0].split('#')[0];

    // 2. Head etiketinde mevcut bir canonical var mı kontrol ediyoruz
    let canonical = document.querySelector("link[rel='canonical']");

    // 3. Yoksa yeni bir etiket oluşturup head kısmına ekliyoruz
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }

    // 4. O anki linki doğrudan içine basıyoruz
    canonical.setAttribute('href', currentUrl);
})();
