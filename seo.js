// O anki sayfanın temiz adresini alıyoruz
const mevcutLink = window.location.href.split('?')[0]; 

// Canonical etiketi var mı diye kontrol ediyoruz
let canonicalEtiketi = document.querySelector("link[rel='canonical']");

// Yoksa yeni bir etiket oluşturup head kısmına ekliyoruz
if (!canonicalEtiketi) {
    canonicalEtiketi = document.createElement('link');
    canonicalEtiketi.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEtiketi);
}

// O anki linki içine basıyoruz
canonicalEtiketi.setAttribute('href', mevcutLink);
