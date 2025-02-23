import { fetchDailyProblem } from "./api/fetchDailyProblem.js";
console.log("Background script loaded successfully!");
// Fired when the browser starts up. b
chrome.runtime.onStartup.addListener(() => {
    updateDailyProblem();
    logLocalStorage();
    tryOpenPOTDWithDelay();
});
  

// Fired when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  updateDailyProblem();
  logLocalStorage();
  tryOpenPOTDWithDelay();
});

function updateDailyProblem() {
  chrome.storage.local.get(["dailyProblem", "dailyProblemDate"], (result) => {
    const { dailyProblem, dailyProblemDate } = result;
    console.log(dailyProblemDate); 
    console.log(getTodaysDate());
    if (
      !dailyProblem ||
      !dailyProblemDate ||
      dailyProblemDate !== getTodaysDate()
    ) {
      fetchDailyProblem();
      console.log("updated link for leetcode potd");
    }
  });
}

//try opening POTD. first get key from storage. 
async function openPOTD() {
    try {
        const url = await getFromStorage("dailyProblem");

        if (!url) {
            console.error("Issue fetching and opening POTD: No URL found.");
            return;
        }

        chrome.tabs.create({ url }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("Failed to open new tab:", chrome.runtime.lastError);
            }
        });
    } catch (error) {
        console.error("Error fetching from storage:", error);
    }
}

//try opening the problem of the day with a delay, will help on starting up a new broswer isntance
function tryOpenPOTDWithDelay(retries = 5, delay = 1000) {
    //see if we have windows
    chrome.windows.getAll({}, (windows) => {
      if (windows.length > 0) {
        openPOTD();
    //retry mechanism. 
      } else if (retries > 0) {
        console.log("No windows open yet. Retrying in 1 second...");
        setTimeout(() => tryOpenPOTDWithDelay(retries - 1, delay), delay);
      } else {
        console.error("Failed to open POTD after multiple attempts.");
      }
    });
  }

function getTodaysDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function logLocalStorage() {
  chrome.storage.local.get(["dailyProblem", "dailyProblemDate"], (result) => {
    console.log("Current dailyProblem:", result.dailyProblem);
    console.log("Current dailyProblemDate:", result.dailyProblemDate);
  });
}

//get any key from storage
function getFromStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result[key]);
            }
        });
    });
}