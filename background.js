const GROQ_API_KEY = "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_CULTURAL_INFO") {
    fetchCulturalInfo(message.word)
      .then(sendResponse)
      .catch((error) => {
        console.error("GET_CULTURAL_INFO failed:", error);
        sendResponse({
          title: message.word,
          culture: "Unknown",
          text: "Could not load cultural information.",
          image: null,
        });
      });
    return true;
  }

  if (message.type === "DETECT_CULTURAL_TERMS") {
    detectCulturalTerms(message.text)
      .then(sendResponse)
      .catch((error) => {
        console.error("DETECT_CULTURAL_TERMS failed:", error);
        sendResponse({
          terms: ["pizza", "ramen", "sushi", "pasta", "kimchi"],
        });
      });
    return true;
  }
});

function getSelectedCountry() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["selectedCountry"], (result) => {
      resolve(result.selectedCountry || "Any");
    });
  });
}

async function detectCulturalTerms(pageText) {
  const fallbackTerms = ["pizza", "ramen", "sushi", "pasta", "kimchi"];
  const trimmedText = (pageText || "").slice(0, 3000);
  const selectedCountry = await getSelectedCountry();

  if (!trimmedText.trim()) {
    console.warn("No page text found, using fallback terms");
    return { terms: fallbackTerms };
  }

  if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
    console.warn("Missing Groq API key, using fallback terms");
    return { terms: fallbackTerms };
  }

  const prompt =
    selectedCountry !== "Any"
      ? `
You are helping a browser extension identify culturally meaningful terms on a webpage.

The user has selected this cultural lens:
${selectedCountry}

From the text below, return a JSON object in exactly this format:
{"terms":["word1","word2","word3"]}

Goal:
Pick words that could be used to explain a cultural connection to ${selectedCountry}.

These words do not have to be inherently cultural.
They may be everyday objects, foods, ingredients, materials, tools, practices, or concepts
that could be used to explain traditions, cuisine, lifestyle, craft, history, or heritage
connected to ${selectedCountry}.

Prioritize:
- foods, ingredients, and dishes connected to ${selectedCountry}
- materials, crops, natural products, or resources associated with ${selectedCountry}
- cooking methods, crafts, tools, or everyday practices that relate to ${selectedCountry}
- traditions and customs of ${selectedCountry}
- festivals and holidays of ${selectedCountry}
- religions and spiritual terms strongly tied to ${selectedCountry}
- ethnic groups, civilizations, dynasties, empires, or historical movements tied to ${selectedCountry}
- clothing, music, art, architecture, symbols, or design traditions tied to ${selectedCountry}
- historically important objects, practices, or cultural symbols tied to ${selectedCountry}

Avoid:
- generic place names like countries, provinces, cities, streets, and neighborhoods
- plain geography by itself unless it directly represents a cuisine, civilization, empire, religion, or major cultural tradition of ${selectedCountry}
- generic words like "food", "history", "people", "culture", "city"
- business names, addresses, navigation words
- terms unrelated to ${selectedCountry}
- terms that are only locations unless they are strongly tied to the culture/history of ${selectedCountry}

Rules:
- use only terms that already appear in the text
- prefer specific nouns or short noun phrases
- max 10 items
- return ONLY valid JSON and nothing else

Text:
${trimmedText}
`
      : `
You are helping a browser extension identify culturally meaningful terms on a webpage.

From the text below, return a JSON object in exactly this format:
{"terms":["word1","word2","word3"]}

Goal:
Pick terms that would make interesting educational cultural popups.

Prioritize:
- foods and dishes
- traditions and customs
- festivals and holidays
- religions and spiritual terms
- ethnic groups, civilizations, dynasties
- clothing, music, art, architecture
- historically important objects, practices, or cultural symbols

Avoid:
- generic place names like countries, provinces, cities, streets, and neighborhoods
- plain geography by itself unless it directly represents a cuisine, civilization, empire, religion, or major cultural tradition
- generic words like "food", "history", "people", "culture", "city"
- business names, addresses, navigation words
- terms that are only locations unless they are strongly tied to culture/history

Rules:
- use only terms that already appear in the text
- prefer specific nouns or short noun phrases
- max 10 items
- return ONLY valid JSON and nothing else

Text:
${trimmedText}
`;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  const data = await response.json();
  console.log("Groq detect response:", data);

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    console.warn("No content from Groq, using fallback terms");
    return { terms: fallbackTerms };
  }

  try {
    const parsed = JSON.parse(content);

    const bannedTerms = [
      "toronto",
      "canada",
      "ontario",
      "prince street",
      "street",
      "road",
      "avenue",
      "downtown",
      "city",
      "country",
    ];

    if (Array.isArray(parsed.terms) && parsed.terms.length > 0) {
      const cleanedTerms = parsed.terms.filter((term) => {
        const lower = term.toLowerCase().trim();
        return !bannedTerms.includes(lower);
      });

      if (cleanedTerms.length > 0) {
        return { terms: cleanedTerms };
      }
    }

    console.warn("Parsed JSON had no useful terms, using fallback");
    return { terms: fallbackTerms };
  } catch (error) {
    console.warn("Invalid JSON from Groq:", content);
    return { terms: fallbackTerms };
  }
}

async function fetchCulturalInfo(word) {
  const selectedCountry = await getSelectedCountry();

  if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
    return {
      title: word,
      culture:
        selectedCountry !== "Any" ? selectedCountry : "Cultural term",
      text:
        selectedCountry !== "Any"
          ? `${word} may have cultural or historical significance in ${selectedCountry}, and is associated with a tradition, heritage, or community connected to that country.`
          : `${word} has cultural or historical significance and is associated with a specific tradition, region, or community.`,
      image: await fetchWikipediaImage(word),
    };
  }

  const prompt =
    selectedCountry !== "Any"
      ? `
Give cultural and historical context for the term "${word}".

The user wants the explanation focused only on:
${selectedCountry}

Return ONLY valid JSON in exactly this format:
{
  "title": "term",
  "culture": "associated culture or region",
  "text": "2 to 4 sentences explaining how the term relates specifically to ${selectedCountry}. If the connection is weak, say that briefly but still give the closest meaningful connection.",
  "imageSearch": "best Wikipedia search term"
}
`
      : `
Give cultural and historical context for the term "${word}".

Return ONLY valid JSON in exactly this format:
{
  "title": "term",
  "culture": "associated culture or region",
  "text": "2 to 4 sentences explaining cultural or historical significance",
  "imageSearch": "best Wikipedia search term"
}
`;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  const data = await response.json();
  console.log("Groq cultural info response:", data);

  const content = data?.choices?.[0]?.message?.content?.trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {
      title: word,
      culture: selectedCountry !== "Any" ? selectedCountry : "Unknown",
      text:
        selectedCountry !== "Any"
          ? `${word} has a cultural or historical connection to ${selectedCountry}, or to traditions and heritage associated with it.`
          : `${word} has cultural or historical significance and is often connected to a specific region, tradition, or community.`,
      imageSearch: word,
    };
  }

  const image = await fetchWikipediaImage(parsed.imageSearch || word);

  return {
    title: parsed.title || word,
    culture:
      parsed.culture ||
      (selectedCountry !== "Any" ? selectedCountry : "Unknown"),
    text: parsed.text || "No cultural information found.",
    image,
  };
}

async function fetchWikipediaImage(searchTerm) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      searchTerm
    )}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const firstResult = searchData?.query?.search?.[0];
    if (!firstResult) return null;

    const title = firstResult.title;

    const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      title
    )}&prop=pageimages&pithumbsize=400&format=json&origin=*`;
    const imageRes = await fetch(imageUrl);
    const imageData = await imageRes.json();

    const pages = imageData?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    return page?.thumbnail?.source || null;
  } catch (error) {
    console.error("Wikipedia image fetch failed:", error);
    return null;
  }
}