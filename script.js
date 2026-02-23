// Your existing code (kept intact) — News fetching/rendering
const API_KEY = "6e5495c6039d4185a361e3a8df216d6c"; // <--- UPDATED API KEY
const url = "https://newsapi.org/v2/everything?q=";

window.addEventListener("load", () => fetchNews("India"));

function reload() {
    window.location.reload();
}

async function fetchNews(query) {
    try {
        const res = await fetch(`${url}${query}&apiKey=${API_KEY}`);
        if (!res.ok) {
            const errorData = await res.json();
            console.error("News API Error:", errorData.message);
            const cardsContainer = document.getElementById("cards-container");
            cardsContainer.innerHTML = `<p style="text-align: center; margin-top: 50px; font-size: 1.2rem; color: var(--accent-color);">
                **Error Loading News:** ${errorData.message}. Please check your API key, or you may have hit the request limit.
            </p>`;
            return;
        }

        const data = await res.json();
        bindData(data.articles);
    } catch (error) {
        console.error("Fetch Error:", error);
        const cardsContainer = document.getElementById("cards-container");
        cardsContainer.innerHTML = `<p style="text-align: center; margin-top: 50px; font-size: 1.2rem; color: red;">
            An unexpected network error occurred. Check your internet connection.
        </p>`;
    }
}

function bindData(articles) {
    const cardsContainer = document.getElementById("cards-container");
    const newsCardTemplate = document.getElementById("template-news-card");

    cardsContainer.innerHTML = "";

    if (articles.length === 0) {
        cardsContainer.innerHTML = `<p style="text-align: center; margin-top: 50px; font-size: 1.2rem; color: var(--secondary-text-color);">No news found for this query.</p>`;
        return;
    }

    articles.forEach((article) => {
        if (!article.urlToImage) return;
        const cardClone = newsCardTemplate.content.cloneNode(true);
        fillDataInCard(cardClone, article);
        cardsContainer.appendChild(cardClone);
    });
}

function fillDataInCard(cardClone, article) {
    const newsImg = cardClone.querySelector("#news-img");
    const newsTitle = cardClone.querySelector("#news-title");
    const newsSource = cardClone.querySelector("#news-source");
    const newsDesc = cardClone.querySelector("#news-desc");

    newsImg.src = article.urlToImage;
    newsImg.onerror = () => { newsImg.src = 'https://via.placeholder.com/400x200?text=Image+Not+Available'; };

    newsTitle.innerHTML = article.title;
    newsDesc.innerHTML = article.description || "Click to read the full article...";

    const date = new Date(article.publishedAt).toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
    });

    newsSource.innerHTML = `${article.source.name} · ${date}`;

    cardClone.firstElementChild.addEventListener("click", () => {
        window.open(article.url, "_blank");
    });
}

let curSelectedNav = null;
function onNavItemClick(id) {
    fetchNews(id);
    const navItem = document.getElementById(id);
    curSelectedNav?.classList.remove("active");
    curSelectedNav = navItem;
    curSelectedNav.classList.add("active");
}

const searchButton = document.getElementById("search-button");
const searchText = document.getElementById("search-text");

searchButton.addEventListener("click", () => {
    const query = searchText.value.trim();
    if (!query) return;
    fetchNews(query);
    curSelectedNav?.classList.remove("active");
    curSelectedNav = null;
    searchText.value = "";
});

searchText.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        searchButton.click();
    }
});


// ===============================================
// VIBEFEED AI ASSISTANT (GEMINI) INTEGRATION
// ===============================================

// ⚠️ IMPORTANT: Replace 'YOUR_GEMINI_API_KEY' with your actual key from Google AI Studio.
const GEMINI_API_KEY = "AIzaSyAjG2UpMAtZ48SRCoBfKn6_QlNFOnDgvu8"; 
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const chatLog = document.getElementById("vf-chat-log");
const chatForm = document.getElementById("vf-chat-form");
const chatInput = document.getElementById("vf-chat-input");
const chatToggle = document.getElementById("vf-chat-toggle");
const chatWidget = document.getElementById("vf-chat");
const chatClose = document.getElementById("vf-chat-close");

// The conversation history array for multi-turn chat
let chatHistory = [
    {
        role: "model",
        parts: [{ text: "Hello! I'm your Vibefeed AI Assistant. Ask me to summarize the news, or anything else!" }]
    }
];

// --- UI Logic ---

chatToggle.addEventListener("click", () => {
    const isHidden = chatWidget.style.display === 'none';
    chatWidget.style.display = isHidden ? 'grid' : 'none';
    chatToggle.innerHTML = isHidden ? '⨉' : '💬';
    if (isHidden) {
        chatInput.focus();
    }
});

chatClose.addEventListener("click", () => {
    chatWidget.style.display = 'none';
    chatToggle.innerHTML = '💬';
});


// --- Chat Functionality ---

function appendMessage(role, text) {
    const msg = document.createElement("div");
    msg.classList.add("vf-msg", role);
    // Convert basic markdown (like bold **text**) to HTML for rendering
    const htmlText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    msg.innerHTML = htmlText;
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to the latest message
}

async function sendGeminiMessage(userMessage) {
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" || !userMessage.trim()) {
        appendMessage("bot", "🚨 Error: Please set your actual **GEMINI_API_KEY** in script.js to use the AI assistant.");
        return;
    }

    // 1. Add user message to history and UI
    const userContent = { role: "user", parts: [{ text: userMessage }] };
    chatHistory.push(userContent);
    appendMessage("user", userMessage);

    // 2. Display a loading message
    const loadingMsg = document.createElement("div");
    loadingMsg.classList.add("vf-msg", "bot", "loading");
    loadingMsg.innerHTML = "• • •";
    chatLog.appendChild(loadingMsg);
    chatLog.scrollTop = chatLog.scrollHeight;
    
    try {
        const response = await fetch(GEMINI_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // Send the entire conversation history to maintain context
                contents: chatHistory,
            }),
        });

        // Remove loading message
        chatLog.removeChild(loadingMsg);
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error ? errorData.error.message : response.statusText;
            appendMessage("bot", `❌ API Error: ${errorMessage}. Check your API key and quota.`);
            // Important: Remove the last user message from history on API failure
            chatHistory.pop(); 
            return;
        }

        const data = await response.json();
        const botResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I received an empty response.";

        // 3. Add bot message to history and UI
        const botContent = { role: "model", parts: [{ text: botResponseText }] };
        chatHistory.push(botContent);
        appendMessage("bot", botResponseText);

    } catch (error) {
        console.error("Gemini Fetch Error:", error);
        // Remove loading message if still present (e.g., network error)
        const currentLoadingMsg = chatLog.querySelector('.loading');
        if (currentLoadingMsg) {
             chatLog.removeChild(currentLoadingMsg);
        }
        appendMessage("bot", "⚠️ Network error. Could not reach the Gemini API.");
        chatHistory.pop(); // Remove the user turn from history
    }
}

// --- Form Submission Handler ---
chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = chatInput.value.trim();
    if (!query) return;

    // Clear input and send message
    chatInput.value = "";
    sendGeminiMessage(query);
});