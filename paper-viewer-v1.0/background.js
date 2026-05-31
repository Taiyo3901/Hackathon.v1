/// <reference types="chrome" />

/**
 * @param {string | undefined} url
 * @returns {boolean}
 */
const isPdfUrl = (url) => {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    if (parsed.protocol === "chrome-extension:") {
      return false;
    }

    if (
      parsed.protocol === "file:" &&
      parsed.pathname.toLowerCase().endsWith(".pdf")
    ) {
      return true;
    }

    if (parsed.pathname.toLowerCase().endsWith(".pdf")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * @param {number} tabId
 * @param {chrome.tabs.TabChangeInfo} changeInfo
 * @param {chrome.tabs.Tab} tab
 */
const handleTabUpdated = (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading") return;
  if (!tab.url) return;

  if (!isPdfUrl(tab.url)) return;

  const viewerUrl = chrome.runtime.getURL(
    `index.html?pdf=${encodeURIComponent(tab.url)}`
  );

  void chrome.tabs.update(tabId, {
    url: viewerUrl,
  });
};

chrome.tabs.onUpdated.addListener(handleTabUpdated);