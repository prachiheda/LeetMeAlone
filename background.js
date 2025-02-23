import { fetchDailyProblem } from "./api/fetchDailyProblem.js";
console.log("Background script loaded successfully!");

(async function init() {
  console.log("Extension background loaded. Recovering daily problem tab...");
  await recoverDailyProblemTab();
})();

// A simple whitelist of URL prefixes we want to allow
const ALLOWED_URL_PREFIXES = [
  "chrome://extensions",  // Manage Extensions
  "https://chatgpt.com"   // ChatGPT
];

// Helper: Check if the given URL starts with any allowed prefix
function isAllowedUrl(url) {
  return ALLOWED_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

// Global variable to store the daily problem tab's ID.
let dailyProblemTabId = null;

// >>> CHANGE: Utility to confirm dailyProblemTabId is a valid integer
function isValidTabId(tabId) {
  return typeof tabId === "number" && !isNaN(tabId);
}

// Fired when the browser starts up.
chrome.runtime.onStartup.addListener(async () => {
  await updateDailyProblem(); // ensures it's done
  tryOpenPOTDWithDelay();
});

// Fired when the extension is installed.
chrome.runtime.onInstalled.addListener(async () => {
  await updateDailyProblem(); // ensures it's done
  tryOpenPOTDWithDelay();
});

// Helper to normalize the stored URL: remove trailing slash if present.
function normalizeStoredUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Use a simple check: if the current tab URL doesn't start with the normalized stored URL, redirect.
async function ensureDailyProblemTab(tabId, currentUrl) {
  const storedUrl = await getStorage("dailyProblem");
  if (!storedUrl) return;

  const normalizedStoredUrl = normalizeStoredUrl(storedUrl);
  
  console.log("Checking tab", tabId, "current URL:", currentUrl);
  console.log("Normalized stored URL:", normalizedStoredUrl);

  if (!currentUrl.startsWith(normalizedStoredUrl)) {
    console.log("Redirecting tab", tabId, "back to stored URL:", normalizedStoredUrl);
    // >>> CHANGE: Check tabId validity before calling update
    if (isValidTabId(tabId)) {
      chrome.tabs.update(tabId, { url: normalizedStoredUrl }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Tab update error:", chrome.runtime.lastError.message);
        }
      });
    }
  }
}

// Listen for tab updates on the daily problem tab only
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId !== dailyProblemTabId) return;
  if (changeInfo.url || changeInfo.status === 'loading') {
    if (tab.url) {
      await ensureDailyProblemTab(tabId, tab.url);
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (activeInfo.tabId !== dailyProblemTabId) return;
  // >>> CHANGE: Check validity before calling get
  if (!isValidTabId(activeInfo.tabId)) return;

  chrome.tabs.get(activeInfo.tabId, async (tab) => {
    if (chrome.runtime.lastError) {
      console.error("Error in tabs.get:", chrome.runtime.lastError.message);
      return;
    }
    if (tab && tab.url) {
      await ensureDailyProblemTab(activeInfo.tabId, tab.url);
    }
  });
});

// Forcibly lock user to daily problem tab unless the new tab is allowed
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (activeInfo.tabId !== dailyProblemTabId) {
    if (!isValidTabId(activeInfo.tabId)) return; // >>> CHANGE
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.warn("Error in tabs.get:", chrome.runtime.lastError.message);
        return;
      }
      if (tab && tab.url) {
        console.log("User activated tab:", tab.url);
        if (!isAllowedUrl(tab.url)) {
          console.log("Locking user to daily problem tab. Switching back...");
          switchToDailyTab(dailyProblemTabId);
        }
      }
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (activeInfo.tabId !== dailyProblemTabId) {
    if (!isValidTabId(activeInfo.tabId)) return; // >>> CHANGE
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.warn("Error in tabs.get:", chrome.runtime.lastError.message);
        return;
      }
      if (tab && tab.url) {
        if (!isAllowedUrl(tab.url)) {
          switchToDailyTab(dailyProblemTabId);
        }
      }
    });
  }
});

// If *any* tab (not dailyProblemTabId) navigates to a new URL, lock them out
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // If we haven't set dailyProblemTabId yet, do nothing
    if (!dailyProblemTabId) return;
  
    // Ignore if it's the daily problem tab
    if (tabId === dailyProblemTabId) return;
  
    // Only proceed if there's a new URL or the tab is loading
    if (changeInfo.url || changeInfo.status === "loading") {
      if (tab.url) {
        // If the new URL is not allowed, force user back
        if (!isAllowedUrl(tab.url)) {
          console.log("Blocking tab", tabId, "URL =", tab.url, "Switching back to daily problem...");
  
          // Option 1: Just switch them back to dailyProblemTabId
          switchToDailyTab(dailyProblemTabId);
  
          // Option 2 (more aggressive): Also close the new tab
          // chrome.tabs.remove(tabId);
        }
      }
    }
  });
  

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return; // focus moved away from Chrome entirely
  }
  chrome.windows.get(windowId, { populate: true }, (window) => {
    if (chrome.runtime.lastError || !window) return;
    const activeTab = window.tabs.find((t) => t.active);
    if (activeTab) {
      handleWindowFocus(activeTab);
    }
  });
});

async function handleWindowFocus(activeTab) {
  if (!isAllowedUrl(activeTab.url) && activeTab.id !== dailyProblemTabId) {
    if (!isValidTabId(dailyProblemTabId)) return; // >>> CHANGE
    chrome.tabs.get(dailyProblemTabId, (dpTab) => {
      if (chrome.runtime.lastError || !dpTab) return;
      chrome.windows.update(dpTab.windowId, { focused: true });
      safeActivateTab(dailyProblemTabId);
    });
  }
}

function safeActivateTab(tabId, retries = 3) {
  if (!isValidTabId(tabId)) return; // >>> CHANGE
  chrome.tabs.update(tabId, { active: true }, () => {
    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message;
      if (msg.includes("dragging") && retries > 0) {
        setTimeout(() => safeActivateTab(tabId, retries - 1), 500);
      } else {
        console.warn("Failed to activate tab:", msg);
      }
    }
  });
}

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === dailyProblemTabId) {
    console.log("Daily problem tab was closed. Recreating...");
    dailyProblemTabId = null;
    openPOTD();
  }
});

function switchToDailyTab(tabId, retryCount = 3) {
  if (!isValidTabId(tabId)) { // >>> CHANGE
    console.warn("Cannot switch to invalid tabId:", tabId);
    return;
  }
  chrome.tabs.update(tabId, { active: true }, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.warn("Tab update error:", lastError.message);
      if (lastError.message.includes("dragging") && retryCount > 0) {
        setTimeout(() => {
          switchToDailyTab(tabId, retryCount - 1);
        }, 500); // retry after 0.5s
      }
    }
  });
}

// Update or fetch the daily problem if needed.
async function updateDailyProblem() {
  const {
    dailyProblem,
    dailyProblemDate,
    dailyProblemTitle,
    dailyProblemDifficulty,
  } = await getStorage([
    "dailyProblem",
    "dailyProblemDate",
    "dailyProblemTitle",
    "dailyProblemDifficulty",
  ]);
  if (
    !dailyProblem ||
    !dailyProblemTitle ||
    !dailyProblemDifficulty ||
    !dailyProblemDate ||
    dailyProblemDate !== getTodaysDate()
  ) {
    await fetchDailyProblem();
    console.log("Updated link for Leetcode POTD");
  }
  recoverDailyProblemTab();
  logLocalStorage();
}

// Open the daily problem tab (or recover an existing one) and store its ID.
async function openPOTD() {
  try {
    const url = await getStorage("dailyProblem");
    if (!url) {
      console.error("Issue fetching and opening POTD: No URL found.");
      return;
    }
    chrome.tabs.query({ url: url }, (tabs) => {
      if (tabs.length > 0) {
        // >>> CHANGE: ensure ID is a number
        dailyProblemTabId = Number(tabs[0].id);
        console.log("Found existing daily problem tab:", dailyProblemTabId);
      } else {
        chrome.tabs.create({ url }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error("Failed to open new tab:", chrome.runtime.lastError);
          } else {
            // >>> CHANGE: ensure tab.id is stored as a number
            dailyProblemTabId = Number(tab.id);
            console.log("Opened new daily problem tab:", dailyProblemTabId);
          }
        });
      }
    });
  } catch (error) {
    console.error("Error fetching from storage:", error);
  }
}

// Attempt to open the POTD tab after a delay.
function tryOpenPOTDWithDelay(retries = 5, delay = 1000) {
  chrome.windows.getAll({}, (windows) => {
    if (windows.length > 0) {
      openPOTD();
    } else if (retries > 0) {
      console.log("No windows open yet. Retrying in 1 second...");
      setTimeout(() => tryOpenPOTDWithDelay(retries - 1, delay), delay);
    } else {
      console.error("Failed to open POTD after multiple attempts.");
    }
  });
}

// Recover the daily problem tab if the extension restarts and the tab exists.
async function recoverDailyProblemTab() {
  const storedUrl = await getStorage("dailyProblem");
  if (!storedUrl) return;
  chrome.tabs.query({ url: storedUrl }, (tabs) => {
    if (tabs.length > 0) {
      // >>> CHANGE: ensure tab.id is stored as a number
      dailyProblemTabId = Number(tabs[0].id);
      console.log("Recovered daily problem tab:", dailyProblemTabId);
    }
  });
}

function getTodaysDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function logLocalStorage() {
  chrome.storage.local.get(
    [
      "dailyProblem",
      "dailyProblemDate",
      "dailyProblemTitle",
      "dailyProblemDifficulty",
    ],
    (result) => {
      console.log("Current dailyProblem:", result.dailyProblem);
      console.log("Current dailyProblemDate:", result.dailyProblemDate);
      console.log("Current dailyProblemTitle:", result.dailyProblemTitle);
      console.log("Current dailyProblemDifficulty:", result.dailyProblemDifficulty);
    }
  );
}

// Helper: Get storage data.
function getStorage(keysOrKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keysOrKey, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        if (typeof keysOrKey === "string") {
          resolve(result[keysOrKey]);
        } else {
          resolve(result);
        }
      }
    });
  });
}
