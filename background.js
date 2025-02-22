import { fetchDailyProblem } from "./api/fetchDailyProblem.js";
console.log("Background script loaded successfully!");
// Fired when the browser starts up
chrome.runtime.onStartup.addListener(() => {
  updateDailyProblem();
  logLocalStorage();
});

// Fired when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  updateDailyProblem();
  logLocalStorage();
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

function getTodaysDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function logLocalStorage() {
  chrome.storage.local.get(["dailyProblem", "dailyProblemDate"], (result) => {
    console.log("Current dailyProblem:", result.dailyProblem);
    console.log("Current dailyProblemDate:", result.dailyProblemDate);
  });
}
