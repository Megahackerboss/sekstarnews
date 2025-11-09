/**
 * Główny skrypt aplikacji Sekstar News.
 * Wersja z optymalizacją ładowania (Paginacja i Caching).
 */
document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // === 1. KONFIGURACJA I INICJALIZACJA FIREBASE ======================
    // =================================================================

    const firebaseConfig = {
        apiKey: "AIzaSyCdc6Xzk_upgrUPX5g6bWAIzgYSQGpyPBY",
        authDomain: "sekstarnews.firebaseapp.com",
        databaseURL: "https://sekstarnews-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "sekstarnews",
        storageBucket: "sekstarnews.appspot.com",
        messagingSenderId: "610657374509",
        appId: "1:610657374509:web:1c90f0ba2ab8e0927183a4"
    };

    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const auth = firebase.auth();
    const ARTICLES_PER_PAGE = 5;
    const COMMENTS_PER_PAGE = 5;

    // =================================================================
    // === 2. ELEMENTY DOM (POPRAWIONE) =================================
    // =================================================================

    const elements = {
        navTitle: document.querySelector('.nav-title'),
        backButton: document.getElementById('back-button'),
        adminButton: document.getElementById('admin-button'),
        adminMenu: {
            container: document.getElementById('admin-menu'),
            addButton: document.getElementById('admin-menu-add'),
            logoutButton: document.getElementById('admin-menu-logout'),
        },
        views: {
            main: document.getElementById('main-view'),
            article: document.getElementById('article-view'),
            editor: document.getElementById('editor-view'),
            login: document.getElementById('login-view'),
        },
        slider: { container: document.getElementById('featured-slider-container') },
        newsList: document.getElementById('news-list-view'),
        articleDetail: {
            date: document.getElementById('article-date'),
            author: document.getElementById('article-author'),
            content: document.getElementById('article-content'),
            likeButton: document.getElementById('like-button'),
            likeCount: document.getElementById('like-count'),
            shareButton: document.getElementById('share-button'),
        },
        commentSection: {
            form: document.getElementById('comment-form'),
            nameInput: document.getElementById('comment-name'),
            messageInput: document.getElementById('comment-message'),
            list: document.getElementById('comments-list'),
        },
        loginForm: {
            emailInput: document.getElementById('login-email'),
            passwordInput: document.getElementById('login-password'),
            submitButton: document.getElementById('login-submit'),
            cancelButton: document.getElementById('login-cancel'),
        },
        editorForm: {
            form: document.getElementById('editor-form'),
            idInput: document.getElementById('editor-id'),
            orderInput: document.getElementById('editor-order'),
            dateInput: document.getElementById('editor-date'),
            titleInput: document.getElementById('editor-title'),
            authorInput: document.getElementById('editor-author'),
            thumbnailInput: document.getElementById('editor-thumbnail'),
            featuredCheckbox: document.getElementById('editor-featured'),
            contentInput: document.getElementById('editor-content'),
            cancelButton: document.getElementById('editor-cancel'),
            deleteButton: document.getElementById('editor-delete'),
        },
        // NOWE PRZYCISKI
        loadMoreArticlesBtn: document.getElementById('load-more-articles-btn'),
        loadMoreCommentsBtn: document.getElementById('load-more-comments-btn'),
        clearCacheBtn: document.getElementById('clear-cache-btn'),
    };

    // =================================================================
    // === 3. STAN APLIKACJI ===========================================
    // =================================================================

    let state = {
        allArticlesMeta: [],
        lastLoadedArticleOrder: null,
        areAllArticlesLoaded: false,
        displayedComments: [],
        lastLoadedCommentKey: null,
        areAllCommentsLoaded: false,
        currentArticle: null,
        isUserAdmin: false,
        commentsListener: null,
        sliderInterval: null,
        currentSlideIndex: 0,
        localUserId: null,
    };

    // =================================================================
    // === 4. LOGIKA UI ================================================
    // =================================================================
    
    function showView(viewToShow) { Object.values(elements.views).forEach(view => view.classList.add('hidden')); if (viewToShow) viewToShow.classList.remove('hidden'); }
    function showMainView() { showView(elements.views.main); elements.backButton.classList.add('hidden'); elements.navTitle.style.marginLeft = '0px'; startSlideInterval(); state.currentArticle = null; if (window.location.hash) window.location.hash = ''; }
    function displayNewsList(articles) { elements.newsList.innerHTML = ''; articles.forEach(article => { const card = document.createElement('div'); card.className = 'article-card'; card.dataset.id = article.id; card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`; elements.newsList.appendChild(card); }); }
    async function displayArticle(articleId) { let articleMeta = state.allArticlesMeta.find(a => a.id == articleId); if (!articleMeta) { try { const snapshot = await database.ref(`articles_meta/${articleId}`).once('value'); articleMeta = snapshot.val(); if (!articleMeta) { showMainView(); return; } state.allArticlesMeta.push(articleMeta); } catch (error) { showMainView(); return; } } state.currentArticle = articleMeta; if (state.commentsListener) state.commentsListener.off(); elements.articleDetail.date.textContent = articleMeta.date; elements.articleDetail.author.textContent = `Autor: ${articleMeta.author}`; elements.articleDetail.content.innerHTML = '<p>Ładowanie treści...</p>'; showView(elements.views.article); elements.backButton.classList.remove('hidden'); elements.navTitle.style.marginLeft = '0px'; clearInterval(state.sliderInterval); const cachedArticle = JSON.parse(localStorage.getItem(`article_${articleId}`)); if (cachedArticle && cachedArticle.lastUpdated >= articleMeta.lastUpdated) { elements.articleDetail.content.innerHTML = cachedArticle.content; } else { database.ref(`articles_content/${articleId}`).once('value', (snapshot) => { const articleContent = snapshot.val(); if (articleContent) { elements.articleDetail.content.innerHTML = articleContent.content; localStorage.setItem(`article_${articleId}`, JSON.stringify({ content: articleContent.content, lastUpdated: articleMeta.lastUpdated })); } }); } state.displayedComments = []; state.lastLoadedCommentKey = null; state.areAllCommentsLoaded = false; elements.commentSection.list.innerHTML = ''; loadMoreComments(); setupLikes(articleId); setupShareButton(articleMeta); }
    function renderComments(comments) { /* ... skopiuj z ostatniej działającej wersji ... */ }
    function setupFeaturedSlider(articles) { /* ... bez zmian ... */ }
    function showSlide(index) { /* ... bez zmian ... */ }
    function startSlideInterval() { /* ... bez zmian ... */ }
    function showEditor(article = null) { if (!state.isUserAdmin) return; elements.editorForm.form.reset(); if (article) { elements.editorForm.idInput.value = article.id; elements.editorForm.orderInput.value = article.order || 99; elements.editorForm.dateInput.value = article.date || new Date().toLocaleString(); elements.editorForm.titleInput.value = article.title || ''; elements.editorForm.authorInput.value = article.author || ''; elements.editorForm.thumbnailInput.value = article.thumbnail || ''; elements.editorForm.featuredCheckbox.checked = article.featured || false; elements.editorForm.deleteButton.classList.remove('hidden'); database.ref(`articles_content/${article.id}`).once('value', s=>elements.editorForm.contentInput.value=s.val()?s.val().content:''); } else { elements.editorForm.idInput.value = Date.now(); elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL'); elements.editorForm.deleteButton.classList.add('hidden'); } showView(elements.views.editor); }
    function updateLikeButton(likesCount, articleId) { /* ... bez zmian ... */ }
    
    // =================================================================
    // === 5. INTERAKCJE Z FIREBASE =====================================
    // =================================================================
    
    function loadInitialArticles() { let query = database.ref('articles_meta').orderByChild('order').limitToFirst(ARTICLES_PER_PAGE); query.once('value', (snapshot) => { const data = snapshot.val(); if (!data) { elements.loadMoreArticlesBtn.classList.add('hidden'); return; } const newArticles = Object.values(data); state.allArticlesMeta = newArticles.sort((a, b) => (a.order || 999) - (b.order || 999)); state.lastLoadedArticleOrder = state.allArticlesMeta[state.allArticlesMeta.length - 1].order; displayNewsList(state.allArticlesMeta); const featured = state.allArticlesMeta.filter(a => a.featured); setupFeaturedSlider(featured); if (newArticles.length < ARTICLES_PER_PAGE) { state.areAllArticlesLoaded = true; elements.loadMoreArticlesBtn.classList.add('hidden'); } else { elements.loadMoreArticlesBtn.classList.remove('hidden'); } }); }
    function loadMoreArticles() { if (state.areAllArticlesLoaded) return; elements.loadMoreArticlesBtn.disabled = true; elements.loadMoreArticlesBtn.textContent = 'Ładowanie...'; let query = database.ref('articles_meta').orderByChild('order').startAfter(state.lastLoadedArticleOrder).limitToFirst(ARTICLES_PER_PAGE); query.once('value', snapshot => { const data = snapshot.val(); if (!data || Object.keys(data).length === 0) { state.areAllArticlesLoaded = true; elements.loadMoreArticlesBtn.classList.add('hidden'); return; } const newArticles = Object.values(data); newArticles.sort((a, b) => (a.order || 999) - (b.order || 999)); state.allArticlesMeta.push(...newArticles); state.lastLoadedArticleOrder = newArticles[newArticles.length - 1].order; displayNewsList(state.allArticlesMeta); elements.loadMoreArticlesBtn.disabled = false; elements.loadMoreArticlesBtn.textContent = 'Wczytaj więcej'; if (newArticles.length < ARTICLES_PER_PAGE) { state.areAllArticlesLoaded = true; elements.loadMoreArticlesBtn.classList.add('hidden'); } }); }
    function loadMoreComments() { if (state.areAllCommentsLoaded || !state.currentArticle) return; elements.loadMoreCommentsBtn.disabled = true; elements.loadMoreCommentsBtn.textContent = 'Ładowanie...'; let query = database.ref(`comments/${state.currentArticle.id}`).orderByKey(); if (state.lastLoadedCommentKey) { query = query.endBefore(state.lastLoadedCommentKey); } query = query.limitToLast(COMMENTS_PER_PAGE); query.once('value', (snapshot) => { const data = snapshot.val(); if (!data) { state.areAllCommentsLoaded = true; elements.loadMoreCommentsBtn.classList.add('hidden'); if(state.displayedComments.length === 0) elements.commentSection.list.innerHTML = '<p>Brak komentarzy.</p>'; return; } const newComments = Object.entries(data).map(([key, val]) => ({ ...val, commentId: key })).reverse(); state.displayedComments.push(...newComments); state.lastLoadedCommentKey = newComments[newComments.length - 1].commentId; renderComments(state.displayedComments); if (newComments.length < COMMENTS_PER_PAGE) { state.areAllCommentsLoaded = true; elements.loadMoreCommentsBtn.classList.add('hidden'); } else { elements.loadMoreCommentsBtn.classList.remove('hidden'); elements.loadMoreCommentsBtn.disabled = false; elements.loadMoreCommentsBtn.textContent = 'Wczytaj więcej komentarzy'; } }); }
    function setupLikes(articleId) { const likesRef = database.ref(`articles/${articleId}/likes`); likesRef.on('value', (snapshot) => updateLikeButton(snapshot.val() || 0, articleId)); elements.articleDetail.likeButton.onclick = () => { const liked = localStorage.getItem(`liked_${articleId}`) === 'true'; if (liked) { localStorage.removeItem(`liked_${articleId}`); likesRef.set(firebase.database.ServerValue.increment(-1)); } else { localStorage.setItem(`liked_${articleId}`, 'true'); likesRef.set(firebase.database.ServerValue.increment(1)); } }; }
    function addComment(author, message) { if (!state.currentArticle || !state.currentArticle.id || !state.localUserId) return; database.ref(`comments/${state.currentArticle.id}`).push().set({ author, message, userId: state.localUserId, timestamp: firebase.database.ServerValue.TIMESTAMP }); }

    // =================================================================
    // === 6. UWIERZYTELNIANIE =========================================
    // =================================================================
    
    function initializeAuth() { auth.onAuthStateChanged(user => { state.isUserAdmin = user && !user.isAnonymous; elements.adminButton.textContent = state.isUserAdmin ? "≡" : "?"; if (!user) auth.signInAnonymously().catch(err => console.error("Błąd logowania anonimowego:", err)); }); }
    function handleAdminLogin() { const email = elements.loginForm.emailInput.value; const pass = elements.loginForm.passwordInput.value; auth.signInWithEmailAndPassword(email, pass).then(() => showView(null)).catch(err => alert(`Błąd logowania: ${err.message}`)); }

    // =================================================================
    // === 7. FUNKCJE POMOCNICZE ========================================
    // =================================================================
    
    function getOrCreateLocalUserId() { let userId = localStorage.getItem('localUserId'); if (!userId) { userId = `user_${Math.random().toString(36).substr(2, 9)}`; localStorage.setItem('localUserId', userId); } return userId; }
    function setupShareButton(article) { if (!article || !article.id) return; elements.articleDetail.shareButton.onclick = async () => { const shareData = { title: article.title, text: `Sprawdź ten artykuł z Sekstar News: ${article.title}`, url: `${window.location.origin}${window.location.pathname}#article-${article.id}` }; try { if (navigator.share) await navigator.share(shareData); else if (navigator.clipboard) { await navigator.clipboard.writeText(shareData.url); alert('Link skopiowany!'); } else throw new Error('No share API'); } catch (err) { window.prompt("Skopiuj ten link:", shareData.url); } }; }
    function handleDeepLink() { const hash = window.location.hash; if (hash && hash.startsWith('#article-')) { const articleId = hash.substring(9); if (state.allArticlesMeta.length > 0) { displayArticle(articleId); } else { setTimeout(() => handleDeepLink(), 200); } } }
    
    // =================================================================
    // === 8. OBSŁUGA ZDARZEŃ ===========================================
    // =================================================================
    
    function handleArticleClick(event) { const target = event.target.closest('[data-id]'); if (target) { window.location.hash = `article-${target.dataset.id}`; window.scrollTo(0, 0); } }
    function bindEventListeners() {
        elements.backButton.addEventListener('click', () => { if (state.commentsListener) state.commentsListener.off(); showMainView(); });
        elements.slider.container.addEventListener('click', handleArticleClick);
        elements.newsList.addEventListener('click', handleArticleClick);
        elements.adminButton.addEventListener('click', () => { if (state.isUserAdmin) elements.adminMenu.container.classList.toggle('hidden'); else showView(elements.views.login); });
        elements.adminMenu.addButton.addEventListener('click', () => { showEditor(null); elements.adminMenu.container.classList.add('hidden'); });
        elements.adminMenu.logoutButton.addEventListener('click', () => { auth.signOut().then(() => { elements.adminMenu.container.classList.add('hidden'); alert("Wylogowano."); }); });
        elements.loginForm.submitButton.addEventListener('click', handleAdminLogin);
        elements.loginForm.cancelButton.addEventListener('click', () => showView(null));
        elements.commentSection.form.addEventListener('submit', (e) => { e.preventDefault(); const name = elements.commentSection.nameInput.value.trim(); const message = elements.commentSection.messageInput.value.trim(); if (name && message) { addComment(name, message); elements.commentSection.form.reset(); } });
        window.addEventListener('hashchange', handleDeepLink);
        elements.loadMoreArticlesBtn.addEventListener('click', loadMoreArticles);
        elements.loadMoreCommentsBtn.addEventListener('click', loadMoreComments);
        elements.clearCacheBtn.addEventListener('click', () => {
            let clearedCount = 0;
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('article_')) { localStorage.removeItem(key); clearedCount++; }
            }
            alert(`Wyczyszczono ${clearedCount} zapisanych artykułów.`);
        });
    }

    // =================================================================
    // === 9. INICJALIZACJA APLIKACJI ==================================
    // =================================================================

    function init() {
        state.localUserId = getOrCreateLocalUserId();
        bindEventListeners();
        initializeAuth();
        loadInitialArticles();
    }
    
    // --- Uzupełnienie reszty funkcji dla kompletności ---
    function setupFeaturedSlider(articles) { if (articles.length === 0) { elements.slider.container.style.display = 'none'; return; } elements.slider.container.style.display = 'block'; elements.slider.container.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`; const content = elements.slider.container.querySelector('.slider-content'); const nav = elements.slider.container.querySelector('.slider-nav'); articles.forEach((article, index) => { const slide = document.createElement('div'); slide.className = 'slide'; slide.dataset.id = article.id; slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`; content.appendChild(slide); const navDot = document.createElement('span'); navDot.className = 'nav-dot'; navDot.dataset.index = index; nav.appendChild(navDot); }); showSlide(0); startSlideInterval(); }
    function showSlide(index) { const slides = elements.slider.container.querySelectorAll('.slide'); const dots = elements.slider.container.querySelectorAll('.nav-dot'); if (!slides.length) return; if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1; slides.forEach(s => s.classList.remove('active')); dots.forEach(d => d.classList.remove('active')); if (slides[index]) slides[index].classList.add('active'); if (dots[index]) dots[index].classList.add('active'); state.currentSlideIndex = index; }
    function startSlideInterval() { clearInterval(state.sliderInterval); state.sliderInterval = setInterval(() => showSlide(state.currentSlideIndex + 1), 8000); }
    function updateLikeButton(likesCount, articleId) { elements.articleDetail.likeCount.textContent = likesCount; const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true'; if (alreadyLiked) { elements.articleDetail.likeButton.classList.add('liked'); elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♥️'; } else { elements.articleDetail.likeButton.classList.remove('liked'); elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♡'; } elements.articleDetail.likeButton.disabled = false; }
    function renderComments(comments) {
    const commentListContainer = elements.commentSection.list;
    
    // Stwórz nową listę w pamięci, aby uniknąć migotania
    const newList = document.createElement('div');

    if (comments.length === 0) {
        newList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
    } else {
        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            commentEl.dataset.commentId = comment.commentId;

            let controls = '';
            if (state.isUserAdmin || comment.userId === state.localUserId) {
                controls = `
                    <div class="comment-controls">
                        <button class="edit-comment-btn">Edytuj</button>
                        <button class="delete-comment-btn">Usuń</button>
                    </div>`;
            }

            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.author || 'Anonim'}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p class="comment-message">${parseCommentFormatting(comment.message || '')}</p>
                ${controls}`;
            
            newList.appendChild(commentEl);
        });
    }
    
    init();
});
