document.addEventListener('DOMContentLoaded', () => {
    // === KONFIGURACJA BASEROW I POŚREDNIKA CORS ===
    const baserowConfig = {
        apiToken: "AgaU9zCmgy88haUkYSnWIJCzl3uqoQRk",
        articlesTableId: "731822",
        commentsTableId: "731833"
    };
    const baserowApiUrl = "https://api.baserow.io/api/database/rows/table/";
    const corsProxyUrl = "https://corsproxy.io/?";

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
    const commentForm = document.getElementById('comment-form');
    const commentsList = document.getElementById('comments-list');

    let allArticles = [];
    let currentArticle = null;
    let slideInterval;
    let currentSlideIndex = 0;

    // --- LOGIKA APLIKACJI ---
    async function loadArticlesConfig() { /* ... bez zmian ... */ }
    async function displayArticle(articleId) { /* ... bez zmian ... */ }
    
    // --- FUNKCJE KOMUNIKACJI Z BASEROW PRZEZ PROXY ---
    
    async function fetchData(url, options = {}) {
        const fetchOptions = { ...options, headers: { ...options.headers, 'Authorization': `Token ${baserowConfig.apiToken}` } };
        const response = await fetch(corsProxyUrl + encodeURIComponent(url), fetchOptions);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Błąd odpowiedzi API Baserow przez proxy:', errorText);
            throw new Error(`Błąd sieci: ${response.statusText}`);
        }
        return response.json();
    }
    
    async function getLikes(articleId) {
        const url = `${baserowApiUrl}${baserowConfig.articlesTableId}/?user_field_names=true&filter__article_id__equal=${articleId}`;
        const data = await fetchData(url);
        const articleData = data.results[0];
        return { likes: articleData ? articleData.likes : 0, row_id: articleData ? articleData.id : null };
    }

    async function getComments(articleId) {
        // TA LINIA ZOSTAŁA POPRAWIONA
        const url = `${baserowApiUrl}${baserowConfig.commentsTableId}/?user_field_names=true&filter__article_id__equal=${articleId}&order_by=-Created%20on`;
        const data = await fetchData(url);
        return data.results;
    }
    
    async function addLike(currentLikes, rowId) { /* ... bez zmian ... */ }
    async function addComment(author, message) { /* ... bez zmian ... */ }

    // --- Pozostałe funkcje (wklejone dla kompletności) ---
    async function loadArticlesConfig() { try { const response = await fetch('articles/articles.json'); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); allArticles = await response.json(); const featuredArticles = allArticles.filter(a => a.featured).slice(0, 5); displayNewsList(allArticles); setupFeaturedSlider(featuredArticles); } catch (error) { console.error("Krytyczny błąd: Nie udało się wczytać pliku articles.json.", error); mainView.innerHTML = "<h1>Wystąpił błąd ładowania strony. Spróbuj odświeżyć.</h1>"; } }
    async function displayArticle(articleId) { currentArticle = allArticles.find(a => a.id == articleId); if (!currentArticle) return; articleDate.textContent = currentArticle.date; articleAuthor.textContent = `Autor: ${currentArticle.author}`; articleContent.innerHTML = currentArticle.content; mainView.classList.add('hidden'); articleView.classList.remove('hidden'); backButton.classList.remove('hidden'); navTitle.style.marginLeft = '0px'; clearInterval(slideInterval); likeCountSpan.textContent = '...'; likeButton.disabled = true; commentsList.innerHTML = '<p>Ładowanie komentarzy...</p>'; try { const [likesData, commentsData] = await Promise.all([ getLikes(articleId), getComments(articleId) ]); updateLikeButton(likesData.likes, likesData.row_id); loadComments(commentsData); } catch (error) { console.error("Błąd pobierania danych z Baserow:", error); likeCountSpan.textContent = 'Błąd'; commentsList.innerHTML = '<p>Nie udało się załadować komentarzy.</p>'; } }
    async function addLike(currentLikes, rowId) { if (!rowId) throw new Error("Błąd: Brak tego artykułu w bazie Baserow."); const url = `${baserowApiUrl}${baserowConfig.articlesTableId}/${rowId}/?user_field_names=true`; const newLikes = currentLikes + 1; const options = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "likes": newLikes }) }; const data = await fetchData(url, options); return data.likes; }
    async function addComment(author, message) { const url = `${baserowApiUrl}${baserowConfig.commentsTableId}/?user_field_names=true`; const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ "article_id": currentArticle.id, "author": author, "message": message }) }; const response = await fetch(corsProxyUrl + encodeURIComponent(url), { ...options, headers: { ...options.headers, Authorization: `Token ${baserowConfig.apiToken}` } }); return response.ok; }
    function updateLikeButton(likes, rowId) { likeCountSpan.textContent = likes; likeButton.disabled = false; const alreadyLiked = localStorage.getItem(`liked_${currentArticle.id}`) === 'true'; if (alreadyLiked) { likeButton.classList.add('liked'); likeButton.querySelector('.heart-icon').textContent = '♥'; likeButton.disabled = true; } else { likeButton.classList.remove('liked'); likeButton.querySelector('.heart-icon').textContent = '♡'; likeButton.onclick = async () => { likeButton.disabled = true; try { const newLikes = await addLike(likes, rowId); localStorage.setItem(`liked_${currentArticle.id}`, 'true'); updateLikeButton(newLikes, rowId); } catch (error) { console.error("Nie udało się zaktualizować polubienia:", error); alert("Wystąpił błąd sieci. Spróbuj ponownie."); likeButton.disabled = false; } }; } }
    function loadComments(comments) { commentsList.innerHTML = ''; if (comments.length === 0) { commentsList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>'; return; } comments.forEach(comment => { const commentEl = document.createElement('div'); commentEl.className = 'comment'; commentEl.innerHTML = `<div class="comment-header"><span class="comment-author">${comment.author || 'Anonim'}</span><span class="comment-date">${new Date(comment['Created on']).toLocaleString()}</span></div><p class="comment-message">${comment.message || ''}</p>`; commentsList.appendChild(commentEl); }); }
    commentForm.onsubmit = async (e) => { e.preventDefault(); const nameInput = document.getElementById('comment-name'); const messageInput = document.getElementById('comment-message'); const submitButton = commentForm.querySelector('button'); submitButton.disabled = true; submitButton.textContent = 'Wysyłanie...'; try { const success = await addComment(nameInput.value, messageInput.value); if (success) { commentForm.reset(); const commentsData = await getComments(currentArticle.id); loadComments(commentsData); } else { alert("Nie udało się dodać komentarza. Spróbuj ponownie."); } } catch (error) { console.error(error); alert("Wystąpił błąd sieci. Spróbuj ponownie."); } finally { submitButton.disabled = false; submitButton.textContent = 'Dodaj komentarz'; } };
    function showMainView() { articleView.classList.add('hidden'); mainView.classList.remove('hidden'); backButton.classList.add('hidden'); navTitle.style.marginLeft = `-${backButton.offsetWidth}px`; startSlideInterval(); currentArticle = null; }
    function setupFeaturedSlider(articles) { if (articles.length === 0) { featuredSliderContainer.style.display = 'none'; return; } featuredSliderContainer.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`; const sliderContent = featuredSliderContainer.querySelector('.slider-content'); const sliderNav = featuredSliderContainer.querySelector('.slider-nav'); articles.forEach((article, index) => { const slide = document.createElement('div'); slide.className = 'slide'; slide.dataset.id = article.id; slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`; sliderContent.appendChild(slide); const navDot = document.createElement('span'); navDot.className = 'nav-dot'; navDot.dataset.index = index; sliderNav.appendChild(navDot); }); showSlide(0); startSlideInterval(); sliderNav.addEventListener('click', (e) => { if (e.target.classList.contains('nav-dot')) { const index = parseInt(e.target.dataset.index, 10); showSlide(index); resetSlideInterval(); } }); }
    function showSlide(index) { const slides = featuredSliderContainer.querySelectorAll('.slide'); const dots = featuredSliderContainer.querySelectorAll('.nav-dot'); if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1; slides.forEach(slide => slide.classList.remove('active')); dots.forEach(dot => dot.classList.remove('active')); if (slides[index]) slides[index].classList.add('active'); if (dots[index]) dots[index].classList.add('active'); currentSlideIndex = index; }
    function nextSlide() { showSlide(currentSlideIndex + 1); }
    function startSlideInterval() { clearInterval(slideInterval); slideInterval = setInterval(nextSlide, 8000); }
    function resetSlideInterval() { clearInterval(slideInterval); startSlideInterval(); }
    function displayNewsList(articles) { newsListView.innerHTML = ''; articles.forEach(article => { const card = document.createElement('div'); card.className = 'article-card'; card.dataset.id = article.id; card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`; newsListView.appendChild(card); }); }
    function init() { backButton.addEventListener('click', showMainView); function handleArticleClick(event) { const targetElement = event.target.closest('[data-id]'); if (targetElement) { displayArticle(targetElement.dataset.id); window.scrollTo(0, 0); } } featuredSliderContainer.addEventListener('click', handleArticleClick); newsListView.addEventListener('click', handleArticleClick); if (backButton.offsetWidth > 0) { navTitle.style.marginLeft = `-${backButton.offsetWidth}px`; } loadArticlesConfig(); }

    init();
});
