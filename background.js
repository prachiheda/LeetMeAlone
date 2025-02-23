import { fetchDailyProblem } from "./api/fetchDailyProblem.js";
console.log("Background script loaded successfully!");
// Fired when the browser starts up. b
chrome.runtime.onStartup.addListener(async () => {
    await updateDailyProblem();  // ensures it's done
    tryOpenPOTDWithDelay();
  });
  

chrome.runtime.onInstalled.addListener(async () => {
    await updateDailyProblem();  // ensures it's done
    tryOpenPOTDWithDelay();
  });

async function updateDailyProblem() {
    const { dailyProblem, dailyProblemDate, dailyProblemTitle, dailyProblemDifficulty } = await getStorage(["dailyProblem", "dailyProblemDate", "dailyProblemTitle", "dailyProblemDifficulty"]);
    if (!dailyProblem || !dailyProblemTitle || !dailyProblemDifficulty ||  !dailyProblemDate || dailyProblemDate !== getTodaysDate()) {
      await fetchDailyProblem();
      console.log("Updated link for Leetcode POTD");
    }
    logLocalStorage(); // logs after everything is done
  }
  

//try opening POTD. first get key from storage. 
async function openPOTD() {
    try {
        const url = await getStorage("dailyProblem");

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
  chrome.storage.local.get(["dailyProblem", "dailyProblemDate", "dailyProblemTitle", "dailyProblemDifficulty"], (result) => {
    console.log("Current dailyProblem:", result.dailyProblem);
    console.log("Current dailyProblemDate:", result.dailyProblemDate);
    console.log("Current dailyProblemTitle:", result.dailyProblemTitle);
    console.log("Current dailyProblemDifficulty:", result.dailyProblemDifficulty);
  });
}

// Convert updateDailyProblem to a proper async function:
function getStorage(keysOrKey) {
    return new Promise((resolve, reject) => {
      // If it's a string, just pass it through; if it's an array, pass the array directly
      const keysParam = typeof keysOrKey === "string"
        ? keysOrKey
        : keysOrKey; // (already an array)
  
      chrome.storage.local.get(keysParam, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          // If the caller passed a string, resolve that one value.
          // If the caller passed an array, resolve the entire object.
          if (typeof keysOrKey === "string") {
            resolve(result[keysOrKey]);
          } else {
            resolve(result);
          }
        }
      });
    });
  }
  