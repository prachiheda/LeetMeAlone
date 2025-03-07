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

document.addEventListener('DOMContentLoaded', async () => {
  const toggleButton = document.getElementById('toggleEnforcement');
  
  // Get initial state
  chrome.runtime.sendMessage({ type: 'GET_ENFORCEMENT_STATE' }, (response) => {
    updateButtonState(response.isEnforcementActive);
  });
  
  // Handle button click
  toggleButton.addEventListener('click', () => {
    const isCurrentlyActive = toggleButton.classList.contains('is-danger');
    
    chrome.runtime.sendMessage(
      { 
        type: 'SET_ENFORCEMENT_STATE',
        isActive: !isCurrentlyActive
      },
      (response) => {
        if (response.success) {
          updateButtonState(!isCurrentlyActive);
        }
      }
    );
  });
  
  // Update button appearance and text using Bulma classes
  function updateButtonState(isActive) {
    toggleButton.textContent = isActive ? 'EMERGENCY STOP' : 'RESUME ENFORCEMENT';
    toggleButton.classList.remove('is-success', 'is-danger');
    toggleButton.classList.add(isActive ? 'is-danger' : 'is-success');
  }
}); 