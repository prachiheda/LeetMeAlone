import { fetchDailyProblem } from "./api/fetchDailyProblem.js";

// Global variables
let dailyProblemTabId = null;
let isEnforcementActive = true; // New state variable
let autoEnforcementTimeout = null;

// Whitelist of URLs that users are allowed to visit
const ALLOWED_URL_PREFIXES = [
  "chrome://extensions",  // Allow access to extension management
  "https://chatgpt.com"   // Allow access to ChatGPT
];

/**
 * Utility Functions
 */

// Checks if a URL is in our allowlist
function isAllowedUrl(url) {
  return ALLOWED_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

// Validates that a tab ID is a proper number (not undefined/null/NaN)
function isValidTabId(tabId) {
  return typeof tabId === "number" && !isNaN(tabId);
}

// Removes trailing slash from URLs for consistent comparison
function normalizeStoredUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Enforcement Control
 */

// Toggle enforcement state
function setEnforcementState(isActive) {
  isEnforcementActive = isActive;
  // Store the state so it persists across extension restarts
  chrome.storage.local.set({ isEnforcementActive });
  console.log(`Tab enforcement is now ${isActive ? 'active' : 'inactive'}`);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_ENFORCEMENT_STATE') {
    sendResponse({ isEnforcementActive });
  } else if (message.type === 'SET_ENFORCEMENT_STATE') {
    setEnforcementState(message.isActive);
    sendResponse({ success: true });
  }
});

// Initialize enforcement state from storage
chrome.storage.local.get(['isEnforcementActive'], (result) => {
  if (result.isEnforcementActive !== undefined) {
    isEnforcementActive = result.isEnforcementActive;
  } else {
    // On first run, check if problem is already solved
    checkProblemSolved().then((isSolved) => {
      if (isSolved) {
        handleProblemSolved();
      }
    });
  }
});

/**
 * Enforcement Schedule Management
 */

// Schedule enforcement to start at next 5 AM
function scheduleNextEnforcement() {
  // Clear any existing timeout
  if (autoEnforcementTimeout) {
    clearTimeout(autoEnforcementTimeout);
  }

  const now = new Date();
  const next5AM = new Date(now);
  next5AM.setHours(5, 0, 0, 0);
  
  // If it's already past 5 AM, schedule for tomorrow
  if (now.getHours() >= 5) {
    next5AM.setDate(next5AM.getDate() + 1);
  }
  
  const msUntil5AM = next5AM.getTime() - now.getTime();
  
  autoEnforcementTimeout = setTimeout(() => {
    setEnforcementState(true);
    console.log("Enforcement automatically resumed at 5 AM");
  }, msUntil5AM);
  
  console.log(`Scheduled enforcement to resume at ${next5AM.toLocaleString()}`);
}

// Check if problem is solved by querying local storage & scraping LeetCode
async function checkProblemSolved() {
  try {
    // Get the daily problem URL from storage
    const url = await getStorage("dailyProblem");
    if (!url) return false;

    // Fetch the problem page while including credentials (cookies)
    const response = await fetch(url, {
      credentials: "include" // Ensure you're logged in
    });

    // Get the HTML text
    const html = await response.text();

    // Look for indicators that the problem has been solved.
    // Adjust or add more indicators as needed:
    const indicators = [
      'Accepted',
      'Check Solution',
      'Submissions.svg',
      '"status_display":"Accepted"',
      'text-message-success'  // <-- Added here
    ];

    // Return true if ANY known indicator appears
    return indicators.some(indicator => html.includes(indicator));

  } catch (error) {
    console.error('Error checking if problem is solved:', error);
    return false;
  }
}


// Add a new function to handle problem completion
async function handleProblemSolved() {
  console.log("Problem solved! Disabling enforcement until 5 AM");
  setEnforcementState(false);
  scheduleNextEnforcement();
}

// Add periodic check for problem completion
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
setInterval(async () => {
  if (isEnforcementActive) { // Only check if enforcement is currently active
    const isSolved = await checkProblemSolved();
    if (isSolved) {
      handleProblemSolved();
    }
  }
}, CHECK_INTERVAL);

/**
 * Initialization & Setup
 */

// Initialize extension on startup
(async function init() {
  console.log("Extension background loaded. Recovering daily problem tab...");
  await recoverDailyProblemTab();
})();

// Handle browser startup - fetch new problem and open tab
chrome.runtime.onStartup.addListener(async () => {
  await updateDailyProblem();
  tryOpenPOTDWithDelay();
});

// Handle extension installation/update - fetch new problem and open tab
chrome.runtime.onInstalled.addListener(async () => {
  await updateDailyProblem();
  tryOpenPOTDWithDelay();
});

/**
 * Tab Management & Navigation Control
 */

// Modify the tab control functions to check enforcement state
async function ensureDailyProblemTab(tabId, currentUrl) {
  if (!isEnforcementActive) return; // Skip if enforcement is disabled
  const storedUrl = await getStorage("dailyProblem");
  if (!storedUrl) return;

  const normalizedStoredUrl = normalizeStoredUrl(storedUrl);
  
  console.log("Checking tab", tabId, "current URL:", currentUrl);
  console.log("Normalized stored URL:", normalizedStoredUrl);

  if (!currentUrl.startsWith(normalizedStoredUrl)) {
    console.log("Redirecting tab", tabId, "back to stored URL:", normalizedStoredUrl);
    if (isValidTabId(tabId)) {
      chrome.tabs.update(tabId, { url: normalizedStoredUrl }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Tab update error:", chrome.runtime.lastError.message);
        }
      });
    }
  }
}

// Modify event listeners to check enforcement state
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!isEnforcementActive) return; // Skip if enforcement is disabled
  if (tabId !== dailyProblemTabId) return;
  if (changeInfo.url || changeInfo.status === 'loading') {
    if (tab.url) {
      await ensureDailyProblemTab(tabId, tab.url);
    }
  }
  
  // If the page finished loading, check if problem is solved
  if (changeInfo.status === 'complete') {
    const isSolved = await checkProblemSolved();
    if (isSolved) {
      handleProblemSolved();
    }
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!isEnforcementActive) return; // Skip if enforcement is disabled
  if (activeInfo.tabId !== dailyProblemTabId) {
    if (!isValidTabId(activeInfo.tabId)) return;
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      
      // If user switches to non-allowed URL, force them back to daily problem
      if (tab && tab.url && !isAllowedUrl(tab.url)) {
        switchToDailyTab(dailyProblemTabId);
      }
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isEnforcementActive) return; // Skip if enforcement is disabled
  if (!dailyProblemTabId) return;
  
  if (tabId === dailyProblemTabId) return;
  
  if (changeInfo.url || changeInfo.status === "loading") {
    if (tab.url) {
      if (!isAllowedUrl(tab.url)) {
        console.log("Blocking tab", tabId, "URL =", tab.url, "Switching back to daily problem...");
  
        switchToDailyTab(dailyProblemTabId);
      }
    }
  }
});

// Handle window focus changes to keep user on task
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!isEnforcementActive) return; // Skip if enforcement is disabled
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
  if (!isEnforcementActive) return; // Skip if enforcement is disabled
  if (!isAllowedUrl(activeTab.url) && activeTab.id !== dailyProblemTabId) {
    if (!isValidTabId(dailyProblemTabId)) return;
    chrome.tabs.get(dailyProblemTabId, (dpTab) => {
      if (chrome.runtime.lastError || !dpTab) return;
      chrome.windows.update(dpTab.windowId, { focused: true });
      safeActivateTab(dailyProblemTabId);
    });
  }
}

// Recreate daily problem tab if it's closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === dailyProblemTabId) {
    console.log("Daily problem tab was closed. Recreating...");
    dailyProblemTabId = null;
    openPOTD();
  }
});

/**
 * Daily Problem Management
 */

// Fetches/updates the daily problem if needed
async function updateDailyProblem() {
  const stored = await getStorage([
    "dailyProblem",
    "dailyProblemDate",
    "dailyProblemTitle",
    "dailyProblemDifficulty",
  ]);
  
  // Fetch new problem if we don't have one or it's from a previous day
  if (!stored.dailyProblem || stored.dailyProblemDate !== getTodaysDate()) {
    await fetchDailyProblem();
    console.log("Updated link for Leetcode POTD");
  }
  
  recoverDailyProblemTab();
  logLocalStorage();
}

// Opens the daily problem in a new tab or finds existing tab
async function openPOTD() {
  try {
    const url = await getStorage("dailyProblem");
    if (!url) {
      console.error("Issue fetching and opening POTD: No URL found.");
      return;
    }
    chrome.tabs.query({ url: url }, (tabs) => {
      if (tabs.length > 0) {
        dailyProblemTabId = Number(tabs[0].id);
        console.log("Found existing daily problem tab:", dailyProblemTabId);
      } else {
        chrome.tabs.create({ url }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error("Failed to open new tab:", chrome.runtime.lastError);
          } else {
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

// Attempts to open POTD tab with retries if Chrome windows aren't ready
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

// Recovers the daily problem tab after extension restart
async function recoverDailyProblemTab() {
  const storedUrl = await getStorage("dailyProblem");
  if (!storedUrl) return;
  chrome.tabs.query({ url: storedUrl }, (tabs) => {
    if (tabs.length > 0) {
      dailyProblemTabId = Number(tabs[0].id);
      console.log("Recovered daily problem tab:", dailyProblemTabId);
    }
  });
}

/**
 * Utility Functions
 */

// Safely switches to the daily problem tab with retry logic
function switchToDailyTab(tabId, retryCount = 3) {
  if (!isValidTabId(tabId)) {
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

// Safely activates a tab with retry logic for when tab is being dragged
function safeActivateTab(tabId, retries = 3) {
  if (!isValidTabId(tabId)) return;
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

// Gets today's date in YYYY-MM-DD format
function getTodaysDate() {
  return new Date().toISOString().split("T")[0];
}

// Logs current storage state for debugging
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

// Promise wrapper for chrome.storage.local.get
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
