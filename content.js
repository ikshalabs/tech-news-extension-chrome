let newsCard = null;

// Create and show news card immediately when extension loads
createNewsCard();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_NEWS') {
        if (newsCard) {
            newsCard.style.display = newsCard.style.display === 'none' ? 'block' : 'none';
            if (newsCard.style.display === 'block') {
                fetchNews();
            }
        }
    }
});

function createNewsCard() {
    if (newsCard) return;

    newsCard = document.createElement('div');
    newsCard.className = 'news-card';
    newsCard.style.display = 'block'; // Make visible by default
    newsCard.innerHTML = `
        <div class="news-header">
            <span>📰 Latest Tech News</span>
            <button class="minimize-button">_</button>
        </div>
        <div class="news-content">
            <div class="loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">
                    Loading your news feed...
                    <div class="loading-subtext">Getting the latest stories</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(newsCard);

    // Make card draggable
    makeDraggable(newsCard);

    newsCard.querySelector('.minimize-button').addEventListener('click', () => {
        newsCard.style.display = 'none';
    });

    fetchNews();
}

function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.querySelector('.news-header').onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

async function fetchNews() {
    try {
        const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const storyIds = await response.json();
        
        const stories = await Promise.all(
            storyIds.slice(0, 6).map(id => 
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
                .then(res => res.json())
            )
        );
        
        displayNews(stories);
    } catch (error) {
        showError();
    }
}

function displayNews(stories) {
    const content = newsCard.querySelector('.news-content');
    content.innerHTML = stories.map((story, index) => {
        // Prepare tweet content with title and URL
        const tweetText = encodeURIComponent(story.title);
        const tweetUrl = encodeURIComponent(story.url || `https://news.ycombinator.com/item?id=${story.id}`);
        
        return `
            <div class="news-item">
                <span class="news-number">${index + 1}</span>
                <div class="news-details">
                    <a href="${story.url || `https://news.ycombinator.com/item?id=${story.id}`}" 
                       target="_blank" 
                       class="news-title">
                        ${story.title}
                    </a>
                    <div class="news-meta">
                        <span>⭐ ${story.score}</span>
                        <a href="https://twitter.com/intent/tweet?text=${tweetText}&url=${tweetUrl}"
                           target="_blank"
                           class="tweet-button"
                           title="Share on Twitter">
                            🐦 Share
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showError() {
    const content = newsCard.querySelector('.news-content');
    content.innerHTML = `
        <div class="error">
            <div class="error-icon">😕</div>
            <div class="error-text">
                Unable to load news
                <div class="error-subtext">Please check your connection and try again</div>
            </div>
        </div>
    `;
} 