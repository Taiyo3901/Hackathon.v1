/// <reference types="chrome" />

/**
 * 指定URLがPDFかどうか判定する
 *
 * @param {string | undefined} url
 * @returns {boolean}
 */
const isPdfUrl = (url) => {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    // 自分自身の拡張ページを再度viewer化しない
    if (parsed.protocol === "chrome-extension:") {
      return false;
    }

    // file:///...pdf
    if (
      parsed.protocol === "file:" &&
      parsed.pathname.toLowerCase().endsWith(".pdf")
    ) {
      return true;
    }

    // https://.../xxx.pdf
    if (parsed.pathname.toLowerCase().endsWith(".pdf")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * PDFタブを自作Viewerに差し替える
 *
 * @param {number} tabId
 * @param {chrome.tabs.TabChangeInfo} changeInfo
 * @param {chrome.tabs.Tab} tab
 * @returns {void}
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