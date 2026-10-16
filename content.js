function extractWalmartData() {
  const currentUrl = window.location.href;

  if (currentUrl.includes("/search")) {
    const productCards = document.querySelectorAll('[data-testid="item-card"]');
    const links = [];

    productCards.forEach(card => {
      const linkEl = card.querySelector('a[data-automation-id="product-anchor"]') || card.querySelector('a');
      if (linkEl && linkEl.href) {
        const cleanUrl = linkEl.href.split('?')[0];
        if (!links.includes(cleanUrl)) links.push(cleanUrl);
      }
    });

    const nextButton = document.querySelector('[aria-label="Next Page"]') || document.querySelector('[data-automation-id="next-page"]');
    const isEnd = !nextButton || productCards.length === 0;

    chrome.runtime.sendMessage({
      action: "SEARCH_PAGE_SCRAPED",
      links: links,
      endOfPagination: isEnd
    });
  } else if (currentUrl.includes("/ip/")) {
    const titleEl = document.querySelector('h1');
    const priceEl = document.querySelector('[data-automation-id="current-price"]') || document.querySelector('.w_iUH7');
    const descEl = document.querySelector('#product-about-section') || document.querySelector('.pt3') || document.querySelector('.mb3');

    const details = {
      title: titleEl ? titleEl.innerText.trim() : "N/A",
      price: priceEl ? priceEl.innerText.replace(/current price/i, '').trim() : "N/A",
      description: descEl ? descEl.innerText.trim().substring(0, 300).replace(/\n/g, ' ') : "No description available"
    };

    chrome.runtime.sendMessage({ action: "PRODUCT_PAGE_SCRAPED", data: details });
  }
}

if (document.readyState === 'complete') {
  extractWalmartData();
} else {
  window.addEventListener('load', extractWalmartData);
}
