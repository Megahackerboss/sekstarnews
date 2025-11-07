document.addEventListener('DOMContentLoaded', () => {
    // === 1. KONFIGURACJA FIREBASE ===
    // !!! WKLEJ TUTAJ SWÓJ OBIEKT firebaseConfig Z KONSOLI FIREBASE !!!
    const firebaseConfig = {
  apiKey: "AIzaSyCdc6Xzk_upgrUPX5g6bWAIzgYSQGpyPBY",
  authDomain: "sekstarnews.firebaseapp.com",
  databaseURL: "https://sekstarnews-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sekstarnews",
  storageBucket: "sekstarnews.firebasestorage.app",
  messagingSenderId: "610657374509",
  appId: "1:610657374509:web:1c90f0ba2ab8e0927183a4",
  measurementId: "G-Z858E3W4CZ"
};

    // Inicjalizacja Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    // === 2. ELEMENTY DOM (wszystkie zdefiniowane w jednym miejscu) ===
    const backButton = document.getElementById('back-button');
    const mainView = document.getElementById('main-view');
    const featuredSliderContainer = document.getElementById('featured-slider-container');
    const newsListView = document.getElementById('news-list-view'); // <-- BRAKUJĄCA ZMIENNA
    const articleView = document.getElementById('article-view');
    const navTitle = document.querySelector('.nav-title');
    const articleContent = document.getElementById('article-content');
    const articleDate = document.getElementById('article-date');
    const articleAuthor = document.getElementById('article-author');
    const likeButton = document.getElementById('like-button');
    const likeCountSpan = document.getElementById('like-count');
    const commentForm = document.getElementById('comment-form');
    const commentsList = document.getElementById('comments-list');

    // Zmienne stanu aplikacji
    let allArticles = [];
    let currentArticle = null;
    let commentsListener = null; 
    let slideInterval;
    let currentSlideIndex = 0;

    // --- 3. GŁÓWNA LOGIKA APLIKACJI ---

    async function loadArticlesConfig() {
        try {
            const response = await fetch('articles/articles.json');
            allArticles = await response.json();
        } catch (error) { 
            console.error("Krytyczny błąd: Nie udało się wczytać articles.json:", error);
            mainView.innerHTML = "<h1>Błąd ładowania konfiguracji strony.</h1>";
        }
    }

    async function displayArticle(articleId) {
        currentArticle = allArticles.find(a => a.id == articleId);
        if (!currentArticle) return;
        
        if (commentsListener) commentsListener.off();

        articleDate.textContent = currentArticle.date;
        articleAuthor.textContent = `Autor: ${currentArticle.author}`;
        articleContent.innerHTML = currentArticle.content;
        
        mainView.classList.add('hidden');
        articleView.classList.remove('hidden');
        backButton.classList.remove('hidden');
        navTitle.style.marginLeft = '0px';
        clearInterval(slideInterval);

        getLikes(articleId);
        listenForComments(articleId);
    }

    // --- 4. FUNKCJE KOMUNIKACJI Z FIREBASE ---

    function getLikes(articleId) {
        const likesRef = database.ref(`articles/${articleId}/likes`);
        likesRef.on('value', (snapshot) => {
            const likes = snapshot.val() || 0;
            updateLikeButton(likes, articleId);
        });
    }

    function addLike(articleId, currentLikes) {
        const likesRef = database.ref(`articles/${articleId}/likes`);
        likesRef.set(currentLikes + 1);
    }
    
    function listenForComments(articleId) {
        commentsListener = database.ref(`comments/${articleId}`).orderByChild('timestamp');
        commentsListener.on('value', (snapshot) => {
            const commentsData = snapshot.val();
            const comments = commentsData ? Object.values(commentsData) : [];
            loadComments(comments.reverse());
        });
    }
    
    function addComment(author, message) {
        const commentsRef = database.ref(`comments/${currentArticle.id}`);
        const newCommentRef = commentsRef.push();
        newCommentRef.set({
            author: author,
            message: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // --- 5. AKTUALIZACJA INTERFEJSU ---
    function updateLikeButton(likes, articleId) {
        likeCountSpan.textContent = likes;
        const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true';

        if (alreadyLiked) {
            likeButton.classList.add('liked');
            likeButton.querySelector('.heart-icon').textContent = '♥';
            likeButton.disabled = true;
        } else {
            likeButton.classList.remove('liked');
            likeButton.querySelector('.heart-icon').textContent = '♡';
            likeButton.disabled = false;
            likeButton.onclick = () => {
                localStorage.setItem(`liked_${articleId}`, 'true');
                addLike(articleId, likes);
            };
        }
    }
    
    function loadComments(comments) {
        commentsList.innerHTML = '';
        if (comments.length === 0) {
            commentsList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
        } else {
            comments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';
                commentEl.innerHTML = `
                    <div class="comment-header">
                        <span class="comment-author">${comment.author || 'Anonim'}</span>
                        <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                    </div>
                    <p class="comment-message">${comment.message || ''}</p>`;
                commentsList.appendChild(commentEl);
            });
        }
    }
    
    commentForm.onsubmit = (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('comment-name');
        const messageInput = document.getElementById('comment-message');
        if (nameInput.value && messageInput.value) {
            addComment(nameInput.value, messageInput.value);
            commentForm.reset();
        }
    };

    // --- 6. FUNKCJE UI (slider, lista, nawigacja) ---
    function showMainView() {
        articleView.classList.add('hidden');
        mainView.classList.remove('hidden');
        backButton.classList.add('hidden');
        if (backButton.offsetWidth > 0) {
            navTitle.style.marginLeft = `-${backButton.offsetWidth}px`;
        }
        startSlideInterval();
        currentArticle = null;
    }

    function displayNewsList(articles) {
        newsListView.innerHTML = '';
        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'article-card';
            card.dataset.id = article.id;
            card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`;
            newsListView.appendChild(card);
        });
    }

    function setupFeaturedSlider(articles) {
        if (articles.length === 0) {
            featuredSliderContainer.style.display = 'none';
            return;
        }
        featuredSliderContainer.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`;
        const sliderContent = featuredSliderContainer.querySelector('.slider-content');
        const sliderNav = featuredSliderContainer.querySelector('.slider-nav');
        articles.forEach((article, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.dataset.id = article.id;
            slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`;
            sliderContent.appendChild(slide);
            const navDot = document.createElement('span');
            navDot.className = 'nav-dot';
            navDot.dataset.index = index;
            sliderNav.appendChild(navDot);
        });
        showSlide(0);
        startSlideInterval();
        sliderNav.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-dot')) {
                const index = parseInt(e.target.dataset.index, 10);
                showSlide(index);
                resetSlideInterval();
            }
        });
    }
    
    function showSlide(index) {
        const slides = featuredSliderContainer.querySelectorAll('.slide');
        const dots = featuredSliderContainer.querySelectorAll('.nav-dot');
        if (index >= slides.length) index = 0;
        if (index < 0) index = slides.length - 1;
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
        currentSlideIndex = index;
    }
    
    function nextSlide() { showSlide(currentSlideIndex + 1); }
    function startSlideInterval() { clearInterval(slideInterval); slideInterval = setInterval(nextSlide, 8000); }
    function resetSlideInterval() { clearInterval(slideInterval); startSlideInterval(); }
    
    // --- 7. INICJALIZACJA APLIKACJI ---
    async function init() {
        await loadArticlesConfig();
        
        const featuredArticles = allArticles.filter(a => a.featured).slice(0, 5);
        displayNewsList(allArticles);
        setupFeaturedSlider(featuredArticles);

        backButton.addEventListener('click', () => {
            if (commentsListener) commentsListener.off();
            showMainView();
        });

        function handleArticleClick(event) {
            const targetElement = event.target.closest('[data-id]');
            if (targetElement) {
                displayArticle(targetElement.dataset.id);
                window.scrollTo(0, 0);
            }
        }
        featuredSliderContainer.addEventListener('click', handleArticleClick);
        newsListView.addEventListener('click', handleArticleClick);
    }

    init();
});
