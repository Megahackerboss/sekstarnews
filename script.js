document.addEventListener('DOMContentLoaded', () => {
    // === KONFIGURACJA BASEROW (Twoje dane zostały już wklejone) ===
    const baserowConfig = {
        apiToken: "AgaU9zCmgy88haUkYSnWIJCzl3uqoQRk",
        articlesTableId: "731822",
        commentsTableId: "731833"
    };
    const baserowApiUrl = "https://api.baserow.io/api/database/rows/table/";

    // === ELEMENTY DOM ===
    const backButton = document.getElementById('back-button');
    const mainView = document.getElementById('main-view');
    const featuredSliderContainer = document.getElementById('featured-slider-container');
    const newsListView = document.getElementById('news-list-view');
    const articleView = document.getElementById('article-view');
    const navTitle = document.querySelector('.nav-title');
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
    let currentSlideIndex = 0;

    // --- LOGIKA WYŚWIETLANIA I UI ---

    // Ładujemy statyczną konfigurację artykułów z pliku JSON
    async function loadArticlesConfig() {
        try {
            const response = await fetch('articles/articles.json');
            allArticles = await response.json();
            const featuredArticles = allArticles.filter(a => a.featured).slice(0, 5);
            displayNewsList(allArticles);
            setupFeaturedSlider(featuredArticles);
        } catch (error) {
            console.error("Krytyczny błąd: Nie udało się wczytać pliku articles.json.", error);
            mainView.innerHTML = "<h1>Wystąpił błąd ładowania strony. Spróbuj odświeżyć.</h1>";
        }
    }
    
    // Otwieranie artykułu i pobieranie DYNAMICZNYCH danych z Baserow
    async function displayArticle(articleId) {
        currentArticle = allArticles.find(a => a.id == articleId);
        if (!currentArticle) return;

        // Wypełniamy statyczną treść
        articleDate.textContent = currentArticle.date;
        articleAuthor.textContent = `Autor: ${currentArticle.author}`;
        articleContent.innerHTML = currentArticle.content;
        
        // Przełączamy widoki
        mainView.classList.add('hidden');
        articleView.classList.remove('hidden');
        backButton.classList.remove('hidden');
        navTitle.style.marginLeft = '0px';
        clearInterval(slideInterval);
        
        // Resetujemy stan przycisków
        likeCountSpan.textContent = '...';
        likeButton.disabled = true;
        commentsList.innerHTML = '<p>Ładowanie komentarzy...</p>';
        
        // POBIERAMY DANE Z BASEROW
        try {
            const [likesData, commentsData] = await Promise.all([
                getLikes(articleId),
                getComments(articleId)
            ]);
            updateLikeButton(likesData.likes, likesData.row_id);
            loadComments(commentsData);
        } catch (error) {
            console.error("Błąd pobierania danych z Baserow:", error);
            likeCountSpan.textContent = 'Błąd';
            commentsList.innerHTML = '<p>Nie udało się załadować komentarzy.</p>';
        }
    }
    
    function showMainView() {
        articleView.classList.add('hidden');
        mainView.classList.remove('hidden');
        backButton.classList.add('hidden');
        navTitle.style.marginLeft = `-${backButton.offsetWidth}px`;
        startSlideInterval();
        currentArticle = null;
    }

    // --- FUNKCJE KOMUNIKACJI Z BASEROW ---

    async function getLikes(articleId) {
        const url = `${baserowApiUrl}${baserowConfig.articlesTableId}/?user_field_names=true&filter__field_2415777__equal=${articleId}`; // UWAGA: Zmieniono na poprawny filtr
        const response = await fetch(url, { headers: { 'Authorization': `Token ${baserowConfig.apiToken}` } });
        if (!response.ok) throw new Error('Błąd sieci podczas pobierania polubień');
        const data = await response.json();
        const articleData = data.results[0];
        return {
            likes: articleData ? articleData.likes : 0,
            row_id: articleData ? articleData.id : null
        };
    }

    async function getComments(articleId) {
        const url = `${baserowApiUrl}${baserowConfig.commentsTableId}/?user_field_names=true&filter__field_2415795__equal=${articleId}&order_by=-id`; // UWAGA: Zmieniono na poprawny filtr
        const response = await fetch(url, { headers: { 'Authorization': `Token ${baserowConfig.apiToken}` } });
        if (!response.ok) throw new Error('Błąd sieci podczas pobierania komentarzy');
        const data = await response.json();
        return data.results;
    }
    
    async function addLike(currentLikes, rowId) {
        if (!rowId) {
            console.error("Błąd: Brak tego artykułu w bazie Baserow.");
            return currentLikes;
        }
        const url = `${baserowApiUrl}${baserowConfig.articlesTableId}/${rowId}/?user_field_names=true`;
        const newLikes = currentLikes + 1;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Authorization': `Token ${baserowConfig.apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ "likes": newLikes })
        });
        if (!response.ok) throw new Error('Błąd sieci podczas dodawania polubienia');
        const data = await response.json();
        return data.likes;
    }

    async function addComment(author, message) {
        const url = `${baserowApiUrl}${baserowConfig.commentsTableId}/?user_field_names=true`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Token ${baserowConfig.apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ "article_id": currentArticle.id, "author": author, "message": message })
        });
        return response.ok;
    }

    // --- AKTUALIZACJA INTERFEJSU (likes, comments) ---

    function updateLikeButton(likes, rowId) {
        likeCountSpan.textContent = likes;
        likeButton.disabled = false;
        
        const alreadyLiked = localStorage.getItem(`liked_${currentArticle.id}`) === 'true';
        if(alreadyLiked) {
            likeButton.classList.add('liked');
            likeButton.querySelector('.heart-icon').textContent = '♥';
            likeButton.disabled = true; // Użytkownik już polubił
        } else {
            likeButton.classList.remove('liked');
            likeButton.querySelector('.heart-icon').textContent = '♡';
            likeButton.onclick = async () => {
                likeButton.disabled = true;
                try {
                    const newLikes = await addLike(likes, rowId);
                    updateLikeButton(newLikes, rowId);
                    localStorage.setItem(`liked_${currentArticle.id}`, 'true'); // Zapisz polubienie w localStorage
                } catch(error) {
                    console.error(error);
                    likeButton.disabled = false;
                }
            };
        }
    }
    
    function loadComments(comments) {
        commentsList.innerHTML = '';
        if (comments.length === 0) {
            commentsList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
            return;
        }
        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.author || 'Anonim'}</span>
                    <span class="comment-date">${new Date(comment['Created on']).toLocaleString()}</span>
                </div>
                <p class="comment-message">${comment.message || ''}</p>
            `;
            commentsList.appendChild(commentEl);
        });
    }

    commentForm.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('comment-name');
        const messageInput = document.getElementById('comment-message');
        const submitButton = commentForm.querySelector('button');
        submitButton.disabled = true;
        submitButton.textContent = 'Wysyłanie...';

        try {
            const success = await addComment(nameInput.value, messageInput.value);
            if (success) {
                commentForm.reset();
                const commentsData = await getComments(currentArticle.id);
                loadComments(commentsData);
            } else {
                alert("Nie udało się dodać komentarza. Spróbuj ponownie.");
            }
        } catch(error) {
            console.error(error);
            alert("Wystąpił błąd sieci. Spróbuj ponownie.");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Dodaj komentarz';
        }
    };
    
    // --- SLIDER I LISTA ARTYKUŁÓW (kod z poprzednich, działających wersji) ---
    function setupFeaturedSlider(articles) { if (articles.length === 0) { featuredSliderContainer.style.display = 'none'; return; } featuredSliderContainer.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`; const sliderContent = featuredSliderContainer.querySelector('.slider-content'); const sliderNav = featuredSliderContainer.querySelector('.slider-nav'); articles.forEach((article, index) => { const slide = document.createElement('div'); slide.className = 'slide'; slide.dataset.id = article.id; slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`; sliderContent.appendChild(slide); const navDot = document.createElement('span'); navDot.className = 'nav-dot'; navDot.dataset.index = index; sliderNav.appendChild(navDot); }); showSlide(0); startSlideInterval(); sliderNav.addEventListener('click', (e) => { if (e.target.classList.contains('nav-dot')) { const index = parseInt(e.target.dataset.index, 10); showSlide(index); resetSlideInterval(); } }); }
    function showSlide(index) { const slides = featuredSliderContainer.querySelectorAll('.slide'); const dots = featuredSliderContainer.querySelectorAll('.nav-dot'); if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1; slides.forEach(slide => slide.classList.remove('active')); dots.forEach(dot => dot.classList.remove('active')); if (slides[index]) slides[index].classList.add('active'); if (dots[index]) dots[index].classList.add('active'); currentSlideIndex = index; }
    function nextSlide() { showSlide(currentSlideIndex + 1); }
    function startSlideInterval() { clearInterval(slideInterval); slideInterval = setInterval(nextSlide, 8000); }
    function resetSlideInterval() { clearInterval(slideInterval); startSlideInterval(); }
    function displayNewsList(articles) { newsListView.innerHTML = ''; articles.forEach(article => { const card = document.createElement('div'); card.className = 'article-card'; card.dataset.id = article.id; card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`; newsListView.appendChild(card); }); }

    // --- INICJALIZACJA APLIKACJI ---
    function init() {
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

        // To jest kluczowy, brakujący element - wywołanie funkcji startowej!
        loadArticlesConfig();
    }

    init(); // Uruchomienie całej aplikacji
});
