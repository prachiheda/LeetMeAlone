const dailyProblemTitleElement = document.getElementById("daily-problem-title"); 
const dailyProblemDifficultyElement = document.getElementById("daily-problem-difficulty"); 

chrome.storage.local.get(
  ["dailyProblem", "dailyProblemDate", "dailyProblemTitle", "dailyProblemDifficulty"],
  (result) => {
    console.log("Retrieved from storage:", result);
    const { dailyProblem, dailyProblemDate, dailyProblemTitle, dailyProblemDifficulty } = result;

    setDailyInfo(dailyProblemTitle, dailyProblemDifficulty);
  }
);


const setDailyInfo = (title, difficulty)=>{
    dailyProblemTitleElement.innerHTML = title; 
    dailyProblemDifficultyElement.innerHTML = difficulty
    if(difficulty==="Easy"){
        dailyProblemDifficultyElement.classList.add("has-text-success")
    }
    if(difficulty==="Medium"){
        dailyProblemDifficultyElement.classList.add("has-text-warning")
    }
    if(difficulty==="Hard"){
        dailyProblemDifficultyElement.classList.add("has-text-danger")
        
    }
}