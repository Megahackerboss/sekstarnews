document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTS ===
    const backButton = document.getElementById('back-button');
    const mainView = document.getElementById('main-view');
    const featuredSliderContainer = document.getElementById('featured-slider-container');
    const newsListView = document.getElementById('news-list-view');
    const articleView = document.getElementById('article-view');
    const navTitle = document.querySelector('.nav-title');

    // Article View Elements
    const articleContent = document.getElementById('article-content');
    const articleDate = document.getElementById('article-date');
    const articleAuthor = document.getElementById('article-author');
    const likeButton = document.getElementById('like-button');
    const likeCountSpan = document.getElementById('like-count');
    const shareButton = document.getElementById('share-button');
    const commentForm = document.getElementById('comment-form');
    const commentsList = document.getElementById('comments-list');

    let allArticles = [];
    let currentArticle = null;
    let slideInterval;

    // === DATA HANDLING (localStorage) ===
    const storage = {
        getLikes: () => JSON.parse(localStorage.getItem('article_likes') || '{}'),
        saveLikes: (likes) => localStorage.setItem('article_likes', JSON.stringify(likes)),
        getComments: () => JSON.parse(localStorage.getItem('article_comments') || '{}'),
        saveComments: (comments) => localStorage.setItem('article_comments', JSON.stringify(comments)),
    };

    // === CORE FUNCTIONS ===
    async function loadArticles() {
        try {
            const response = await fetch('articles/articles.json');
            allArticles = await response.json();
            const featuredArticles = allArticles.filter(a => a.featured).slice(0, 5);
            
            setupFeaturedSlider(featuredArticles);
            displayNewsList(allArticles); // Display all articles in the list
        } catch (error) {
            console.error("Nie udało się wczytać artykułów:", error);
        }
    }

    function displayArticle(articleId) {
        currentArticle = allArticles.find(a => a.id == articleId);
        if (currentArticle) {
            // Populate article content and meta
            articleDate.textContent = currentArticle.date;
            articleAuthor.textContent = `Autor: ${currentArticle.author}`;
            articleContent.innerHTML = currentArticle.content;

            // Setup interactive elements
            setupLikeButton(articleId);
            setupShareButton(currentArticle);
            setupCommentSection(articleId);

            // Switch views
            mainView.classList.add('hidden');
            articleView.classList.remove('hidden');
            backButton.classList.remove('hidden');
            navTitle.style.marginLeft = '0px';
            clearInterval(slideInterval);
        }
    }
    
    function showMainView() {
        articleView.classList.add('hidden');
        mainView.classList.remove('hidden');
        backButton.classList.add('hidden');
        navTitle.style.marginLeft = `-${backButton.offsetWidth}px`;
        startSlideInterval();
        currentArticle = null; // Clear current article
    }
    
    // === INTERACTIVE ELEMENTS SETUP ===

    // --- Like Button Logic ---
    function setupLikeButton(articleId) {
        const allLikes = storage.getLikes();
        let likes = allLikes[articleId] || { count: 0, users: [] }; // For simplicity, we just check a flag
        
        likeCountSpan.textContent = likes.count;
        if (likes.users.includes('currentUser')) { // Simple check
            likeButton.classList.add('liked');
            likeButton.querySelector('.heart-icon').textContent = '♥';
        } else {
            likeButton.classList.remove('liked');
            likeButton.querySelector('.heart-icon').textContent = '♡';
        }
        
        likeButton.onclick = () => handleLikeClick(articleId);
    }

    function handleLikeClick(articleId) {
        const allLikes = storage.getLikes();
        let likes = allLikes[articleId] || { count: 0, users: [] };
        
        if (likes.users.includes('currentUser')) {
            likes.count--;
            likes.users = []; // Remove user
        } else {
            likes.count++;
            likes.users = ['currentUser']; // Add user
        }

        allLikes[articleId] = likes;
        storage.saveLikes(allLikes);
        setupLikeButton(articleId); // Refresh button state
    }

    // --- Share Button Logic ---
    function setupShareButton(article) {
        shareButton.onclick = async () => {
            const shareData = {
                title: article.title,
                text: `Sprawdź ten artykuł z Brawl Stars News: ${article.title}`,
                // Tworzymy unikalny link do artykułu, chociaż strona jest jednostronicowa
                url: `${window.location.origin}${window.location.pathname}#article-${article.id}`
            };

            try {
                // Próba 1: Użycie natywnego udostępniania (najlepsze dla telefonów)
                if (navigator.share) {
                    await navigator.share(shareData);
                    // Jeśli udostępnianie się powiedzie, funkcja kończy działanie tutaj.
                    return; 
                }
                // Jeśli navigator.share nie istnieje, kod przejdzie dalej.
                
                // Próba 2: Kopiowanie do schowka (dla komputerów i niektórych WebView)
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareData.url);
                    alert('Link do artykułu skopiowany do schowka!');
                } else {
                    // Jeśli obie powyższe metody zawiodą...
                    throw new Error('APIs not supported');
                }

            } catch (err) {
                console.warn("Automatyczne udostępnianie/kopiowanie nie powiodło się:", err);
                
                // Próba 3: Ostateczne rozwiązanie - okienko do ręcznego kopiowania
                window.prompt(
                    "Nie udało się udostępnić automatycznie. Skopiuj ten link ręcznie (Ctrl+C):", 
                    shareData.url
                );
            }
        };
    }

    // --- Comments Logic ---
    function setupCommentSection(articleId) {
        loadComments(articleId);
        commentForm.onsubmit = (e) => {
            e.preventDefault();
            handleCommentSubmit(articleId);
        };
    }

    function loadComments(articleId) {
        const allComments = storage.getComments();
        const articleComments = allComments[articleId] || [];
        commentsList.innerHTML = '';
        if (articleComments.length === 0) {
            commentsList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
            return;
        }
        articleComments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.name}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p class="comment-message">${comment.message}</p>
            `;
            commentsList.appendChild(commentEl);
        });
    }

    function handleCommentSubmit(articleId) {
        const nameInput = document.getElementById('comment-name');
        const messageInput = document.getElementById('comment-message');

        const newComment = {
            name: nameInput.value,
            message: messageInput.value,
            timestamp: new Date().toISOString()
        };

        const allComments = storage.getComments();
        const articleComments = allComments[articleId] || [];
        articleComments.push(newComment);
        allComments[articleId] = articleComments;
        
        storage.saveComments(allComments);
        
        // Reset form and reload comments
        nameInput.value = '';
        messageInput.value = '';
        loadComments(articleId);
    }
    
    // === INITIALIZATION & EVENT LISTENERS ===
    function init() {
        loadArticles();
        backButton.addEventListener('click', showMainView);
        
        function handleArticleClick(event) {
            const targetElement = event.target.closest('[data-id]');
            if (targetElement) {
                displayArticle(targetElement.dataset.id);
                window.scrollTo(0, 0);
            }
        }
        featuredSliderContainer.addEventListener('click', handleArticleClick);
        newsListView.addEventListener('click', handleArticleClick);
        
        navTitle.style.marginLeft = `-${backButton.offsetWidth}px`;
    }
    
    // Slider functions (unchanged from previous version)
    let currentSlideIndex = 0;
    function setupFeaturedSlider(articles) { if (articles.length === 0) return; featuredSliderContainer.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`; const sliderContent = featuredSliderContainer.querySelector('.slider-content'); const sliderNav = featuredSliderContainer.querySelector('.slider-nav'); articles.forEach((article, index) => { const slide = document.createElement('div'); slide.className = 'slide'; slide.dataset.id = article.id; slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`; sliderContent.appendChild(slide); const navDot = document.createElement('span'); navDot.className = 'nav-dot'; navDot.dataset.index = index; sliderNav.appendChild(navDot); }); showSlide(0); startSlideInterval(); sliderNav.addEventListener('click', (e) => { if (e.target.classList.contains('nav-dot')) { const index = parseInt(e.target.dataset.index, 10); showSlide(index); resetSlideInterval(); } }); }
    function showSlide(index) { const slides = featuredSliderContainer.querySelectorAll('.slide'); const dots = featuredSliderContainer.querySelectorAll('.nav-dot'); if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1; slides.forEach(slide => slide.classList.remove('active')); dots.forEach(dot => dot.classList.remove('active')); slides[index].classList.add('active'); dots[index].classList.add('active'); currentSlideIndex = index; }
    function nextSlide() { showSlide(currentSlideIndex + 1); }
    function startSlideInterval() { clearInterval(slideInterval); slideInterval = setInterval(nextSlide, 8000); }
    function resetSlideInterval() { clearInterval(slideInterval); startSlideInterval(); }
    function displayNewsList(articles) { newsListView.innerHTML = ''; articles.forEach(article => { const card = document.createElement('div'); card.className = 'article-card'; card.dataset.id = article.id; card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`; newsListView.appendChild(card); }); }
    
    init();
});