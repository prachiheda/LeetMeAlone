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
    const slug = data.data.activeDailyCodingChallengeQuestion.question.titleSlug;
    const date = data.data.activeDailyCodingChallengeQuestion.date;
  const link = `https://leetcode.com/problems/${slug}`;
  
   // Store both link and date in local storage together
   await chrome.storage.local.set({
    dailyProblem: link,
    dailyProblemDate: date,
  })

  console.log("leetcode potd: ", link);
  console.log("leetcode potd date: ", date);
  return link;
}
 catch(err){
    console.error("Failed to fetch daily problem:", err);
    return null;
 }
  
}
