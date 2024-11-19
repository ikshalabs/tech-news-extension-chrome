let newsCard = null;

// Create and show card immediately when extension loads
createCard();

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

function createCard() {
    if (newsCard) return;

    newsCard = document.createElement('div');
    newsCard.className = 'news-card';
    newsCard.style.display = 'block';
    newsCard.innerHTML = `
        <div class="news-header">
            <span>📱 Dashboard</span>
            <button class="minimize-button">_</button>
        </div>
        <div class="tabs">
            <button class="tab-button active" data-tab="news">📰 News</button>
            <button class="tab-button" data-tab="todos">✅ Todos</button>
        </div>
        <div class="tab-content">
            <div id="news-tab" class="tab-pane active">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">
                        Loading news...
                    </div>
                </div>
            </div>
            <div id="todos-tab" class="tab-pane">
                <div class="todo-input-wrapper">
                    <input type="text" class="todo-input" placeholder="Add a new task...">
                    <button class="add-todo-btn">+</button>
                </div>
                <div class="todos-list"></div>
            </div>
        </div>
    `;

    document.body.appendChild(newsCard);

    // Make card draggable
    makeDraggable(newsCard);

    // Add event listeners
    setupEventListeners();
    
    // Load initial content
    fetchNews();
    loadTodos();
}

function setupEventListeners() {
    // Minimize button
    newsCard.querySelector('.minimize-button').addEventListener('click', () => {
        newsCard.style.display = 'none';
    });

    // Tab switching
    newsCard.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Update active tab button
            newsCard.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update active tab content
            newsCard.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            newsCard.querySelector(`#${button.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Todo input
    const todoInput = newsCard.querySelector('.todo-input');
    const addTodoBtn = newsCard.querySelector('.add-todo-btn');

    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });

    addTodoBtn.addEventListener('click', () => addTodo());
}

// Todo Functions
function addTodo() {
    const todoInput = newsCard.querySelector('.todo-input');
    const text = todoInput.value.trim();
    
    if (text) {
        const todos = getTodos();
        todos.push({
            id: Date.now(),
            text,
            completed: false,
            createdAt: new Date().toISOString()
        });
        saveTodos(todos);
        renderTodos();
        todoInput.value = '';
    }
}

function getTodos() {
    return JSON.parse(localStorage.getItem('extension_todos') || '[]');
}

function saveTodos(todos) {
    localStorage.setItem('extension_todos', JSON.stringify(todos));
}

function loadTodos() {
    renderTodos();
}

function renderTodos() {
    const todosList = newsCard.querySelector('.todos-list');
    const todos = getTodos();

    todosList.innerHTML = todos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
            <input type="checkbox" 
                   class="todo-checkbox" 
                   ${todo.completed ? 'checked' : ''}>
            <span class="todo-text">${todo.text}</span>
            <button class="delete-todo">×</button>
        </div>
    `).join('');

    // Add event listeners to new todo items
    todosList.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const todoId = parseInt(e.target.closest('.todo-item').dataset.id);
            toggleTodo(todoId);
        });
    });

    todosList.querySelectorAll('.delete-todo').forEach(button => {
        button.addEventListener('click', (e) => {
            const todoId = parseInt(e.target.closest('.todo-item').dataset.id);
            deleteTodo(todoId);
        });
    });
}

function toggleTodo(id) {
    const todos = getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos(todos);
        renderTodos();
    }
}

function deleteTodo(id) {
    const todos = getTodos();
    const filteredTodos = todos.filter(t => t.id !== id);
    saveTodos(filteredTodos);
    renderTodos();
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

// News Functions
async function fetchNews() {
    const newsTab = newsCard.querySelector('#news-tab');
    newsTab.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">
                Loading news...
            </div>
        </div>
    `;

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
        console.error('Error fetching news:', error);
        showError();
    }
}

function displayNews(stories) {
    const newsTab = newsCard.querySelector('#news-tab');
    
    if (!stories || !stories.length) {
        showError();
        return;
    }

    newsTab.innerHTML = stories.map((story, index) => {
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