(function() {
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    
    // 1. Canonical adresini zorunlu yapıyoruz
    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', currentUrl);

    // 2. Mağaza sayfalarında başlığı (Title) ana sayfadan ayırıyoruz
    if (currentUrl.includes('/magaza/')) {
        const checkContent = setInterval(() => {
            // Mağaza adını sayfadaki başlık veya dükkan adından yakalamaya çalışıyoruz
            const storeTitleElement = document.querySelector('h1') || document.querySelector('.store-title');
            if (storeTitleElement && storeTitleElement.innerText.trim() !== "") {
                const storeName = storeTitleElement.innerText.trim();
                document.title = storeName + " - KıbrısBazar";
                clearInterval(checkContent);
            }
        }, 500);
    }
})();
