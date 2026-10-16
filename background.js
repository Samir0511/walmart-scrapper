const DEFAULT_TARGET = 300;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_SCRAPING") {
    runSearchFlow(request.tabId, request.url);
  }
  if (request.action === "SEARCH_PAGE_SCRAPED") {
    processSearchLinks(sender.tab.id, request.links, request.endOfPagination);
  }
  if (request.action === "PRODUCT_PAGE_SCRAPED") {
    processProductDetails(sender.tab.id, request.data);
  }
});

async function getTargetLimit() {
  const { targetLimit } = await chrome.storage.local.get(['targetLimit']);
  return targetLimit ?? DEFAULT_TARGET;
}

async function finishScraping(savedCount) {
  await chrome.storage.local.set({ isScraping: false, productLinksQueue: [] });
  chrome.runtime.sendMessage({
    action: "STATUS_UPDATE",
    text: `✅ Scraping complete! Successfully scraped ${savedCount} items.`,
    finished: true
  });
}

async function runSearchFlow(tabId, currentUrl) {
  const state = await chrome.storage.local.get(['currentPage']);
  const urlObj = new URL(currentUrl);
  urlObj.searchParams.set('page', state.currentPage);
  chrome.tabs.update(tabId, { url: urlObj.toString() });
}

async function processSearchLinks(tabId, newLinks, endOfPagination) {
  const state = await chrome.storage.local.get(['productLinksQueue', 'currentPage', 'targetLimit']);
  const targetLimit = state.targetLimit ?? DEFAULT_TARGET;
  let updatedQueue = [...state.productLinksQueue, ...newLinks];

  if (updatedQueue.length >= targetLimit) {
    updatedQueue = updatedQueue.slice(0, targetLimit);
    await chrome.storage.local.set({ productLinksQueue: updatedQueue });
    chrome.runtime.sendMessage({
      action: "STATUS_UPDATE",
      text: `🎯 Target links caught (${updatedQueue.length}). Commencing detail scraping...`
    });
    scrapeNextDetailItem(tabId);
    return;
  }

  if (endOfPagination || newLinks.length === 0) {
    await chrome.storage.local.set({ productLinksQueue: updatedQueue });
    chrome.runtime.sendMessage({
      action: "STATUS_UPDATE",
      text: `🛑 Pagination reached natural end early. Links captured: ${updatedQueue.length}. Moving to details...`
    });
    if (updatedQueue.length > 0) {
      scrapeNextDetailItem(tabId);
    } else {
      chrome.runtime.sendMessage({
        action: "STATUS_UPDATE",
        text: "❌ No products found across any pages.",
        finished: true
      });
    }
    return;
  }

  await chrome.storage.local.set({ productLinksQueue: updatedQueue });
  const nextPage = state.currentPage + 1;
  await chrome.storage.local.set({ currentPage: nextPage });
  chrome.runtime.sendMessage({
    action: "STATUS_UPDATE",
    text: `🔍 Found ${updatedQueue.length}/${targetLimit} links. Moving to page ${nextPage}...`
  });

  setTimeout(async () => {
    const tab = await chrome.tabs.get(tabId);
    runSearchFlow(tabId, tab.url);
  }, 3500);
}

async function scrapeNextDetailItem(tabId) {
  const targetLimit = await getTargetLimit();
  const state = await chrome.storage.local.get(['productLinksQueue', 'scrapedProducts']);

  if (state.scrapedProducts.length >= targetLimit) {
    await finishScraping(state.scrapedProducts.length);
    return;
  }

  if (state.productLinksQueue.length === 0) {
    await finishScraping(state.scrapedProducts.length);
    return;
  }

  const nextUrl = state.productLinksQueue.shift();
  await chrome.storage.local.set({ productLinksQueue: state.productLinksQueue });

  chrome.runtime.sendMessage({
    action: "STATUS_UPDATE",
    text: `⏳ Digging details... Items remaining: ${state.productLinksQueue.length} | Saved: ${state.scrapedProducts.length}/${targetLimit}`
  });

  chrome.tabs.update(tabId, { url: nextUrl });
}

async function processProductDetails(tabId, productData) {
  const targetLimit = await getTargetLimit();
  const state = await chrome.storage.local.get(['scrapedProducts']);
  let updatedList = [...state.scrapedProducts, productData];

  if (updatedList.length >= targetLimit) {
    updatedList = updatedList.slice(0, targetLimit);
    await chrome.storage.local.set({ scrapedProducts: updatedList, isScraping: false, productLinksQueue: [] });
    chrome.runtime.sendMessage({
      action: "STATUS_UPDATE",
      text: `✅ Target reached: ${updatedList.length} product detail datasets saved.`,
      finished: true
    });
    return;
  }

  await chrome.storage.local.set({ scrapedProducts: updatedList });

  setTimeout(() => {
    scrapeNextDetailItem(tabId);
  }, 4000);
}
