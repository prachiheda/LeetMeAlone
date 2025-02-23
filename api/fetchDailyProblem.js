const ENDPOINT = "https://leetcode.com/graphql/";

//api call
//fetch daily problem, put it into local storage
export const fetchDailyProblem = async () => {
  try {const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
            {
          activeDailyCodingChallengeQuestion {
            date
            link
            question {
              difficulty
              title
              titleSlug
            }
          }
        }`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Network response was not ok: ${response.status}`);
  }
  const data = await response.json();
  console.log("API response question:", data.data.activeDailyCodingChallengeQuestion.question);

    const slug = data.data.activeDailyCodingChallengeQuestion.question.titleSlug;
    const title = data.data.activeDailyCodingChallengeQuestion.question.title;
    console.log("testing from the api", title); 
    const date = data.data.activeDailyCodingChallengeQuestion.date;
    const difficulty = data.data.activeDailyCodingChallengeQuestion.question.difficulty;
  const link = `https://leetcode.com/problems/${slug}`;

   // Store both link and date in local storage together
   await new Promise((resolve) => {
    chrome.storage.local.set({
        dailyProblemTitle: title,
        dailyProblem: link,
      dailyProblemDate: date,
      dailyProblemDifficulty: difficulty

      
    }, resolve);
  });

  console.log("leetcode potd: ", link);
  console.log("leetcode potd date: ", date);
  console.log("leetcode potd title: ", title);
  return link;
}
 catch(err){
    console.error("Failed to fetch daily problem:", err);
    return null;
 }
  
}
