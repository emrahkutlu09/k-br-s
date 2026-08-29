(function() {
    // 1. Mevcut sayfanın temiz URL'sini alıyoruz
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    
    // 2. Head etiketinde mevcut bir canonical var mı kontrol ediyoruz
    let canonical = document.querySelector("link[rel='canonical']");
    
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    
    // 3. Kesinlikle o anki sayfanın kendi adresini zorunlu kılıyoruz
    canonical.setAttribute('href', currentUrl);

    // 4. Eğer mağaza sayfasındaysak Google'ın ana sayfa ile karıştırmaması için başlığı güçlendiriyoruz
    if (currentUrl.includes('/magaza/')) {
        setTimeout(() => {
            if (document.title === "KıbrısBazar" || document.title === "") {
                const pathParts = currentUrl.split('/');
                const storeId = pathParts[pathParts.length - 1];
                if (storeId) {
                    document.title = "Mağaza Detayı - KıbrısBazar";
                }
            }
        }, 1000);
    }
})();
