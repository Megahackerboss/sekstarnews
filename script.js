document.addEventListener('DOMContentLoaded', () => {
    // === 1. KONFIGURACJA FIREBASE ===
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

    // === 2. ELEMENTY DOM ===
    const backButton = document.getElementById('back-button');
    const mainView = document.getElementById('main-view');
    const featuredSliderContainer = document.getElementById('featured-slider-container');
    const newsListView = document.getElementById('news-list-view');
    const articleView = document.getElementById('article-view');
    const navTitle = document.querySelector('.nav-title');
    const editorView = document.getElementById('editor-view');
    const loginView = document.getElementById('login-view');
    const adminButton = document.getElementById('admin-button');
    const adminMenu = document.getElementById('admin-menu');
    const editorForm = document.getElementById('editor-form');
    const editorCancelButton = document.getElementById('editor-cancel');
    const editorDeleteButton = document.getElementById('editor-delete');

    // === 3. ZMIENNE STANU APLIKACJI ===
    let allArticles = [];
    let currentArticle = null;
    let commentsListener = null;
    let loggedIn = false;
    let slideInterval;
    let currentSlideIndex = 0;

    // === 4. LOGIKA LOGOWANIA (WIDOCZNE I NIEWIDOCZNE) ===
    auth.onAuthStateChanged(user => {
        if (user) {
            // Użytkownik jest zalogowany (jako admin lub anonimowo)
            if (!user.isAnonymous) {
                // To jest admin, bo tylko on loguje się przez e-mail/hasło
                loggedIn = true;
                adminButton.textContent = "≡";
            }
            // Jeśli jest anonimowy, nic specjalnego nie robimy - po prostu ma "bilet"
        } else {
            // Nikt nie jest zalogowany, nawet anonimowo. Dajemy mu "bilet".
            auth.signInAnonymously().catch(error => {
                console.error("Błąd logowania anonimowego:", error);
                // Można tu dodać informację dla użytkownika, że strona może nie działać w pełni
            });
        }
    });

    adminButton.addEventListener('click', () => {
        if (loggedIn) {
            adminMenu.classList.toggle('hidden');
        } else {
            loginView.classList.remove('hidden');
        }
    });

    document.getElementById('admin-menu-add').addEventListener('click', () => { showEditor(null); adminMenu.classList.add('hidden'); });
    document.getElementById('admin-menu-logout').addEventListener('click', () => { auth.signOut().then(() => { loggedIn = false; adminButton.textContent = "?"; adminMenu.classList.add('hidden'); alert("Wylogowano."); }); });
    document.getElementById('login-cancel').addEventListener('click', () => loginView.classList.add('hidden'));
    document.getElementById('login-submit').addEventListener('click', () => { const email = document.getElementById('login-email').value; const pass = document.getElementById('login-password').value; auth.signInWithEmailAndPassword(email, pass).then(() => loginView.classList.add('hidden')).catch(error => alert(`Błąd logowania: ${error.message}`)); });

    // === 5. GŁÓWNA LOGIKA APLIKACJI ===
    function loadArticlesFromFirebase() { const contentRef = database.ref('content'); contentRef.on('value', (snapshot) => { const data = snapshot.val(); allArticles = data ? Object.values(data) : []; allArticles.sort((a, b) => (a.order || 999) - (b.order || 999)); const featuredArticles = allArticles.filter(a => a.featured).slice(0, 5); displayNewsList(allArticles); setupFeaturedSlider(featuredArticles); }); }
    function displayArticle(articleId) { currentArticle = allArticles.find(a => a.id == articleId); if (!currentArticle) return; if (commentsListener) commentsListener.off(); const articleDate = document.getElementById('article-date'); const articleAuthor = document.getElementById('article-author'); const articleContent = document.getElementById('article-content'); articleDate.textContent = currentArticle.date; articleAuthor.textContent = `Autor: ${currentArticle.author}`; articleContent.innerHTML = currentArticle.content; mainView.classList.add('hidden'); articleView.classList.remove('hidden'); backButton.classList.remove('hidden'); navTitle.style.marginLeft = '0px'; clearInterval(slideInterval); getLikes(articleId); listenForComments(articleId);setupShareButton(currentArticle); }
    function getLikes(articleId) { const likesRef = database.ref(`articles/${articleId}/likes`); likesRef.on('value', (snapshot) => { const likes = snapshot.val() || 0; updateLikeButton(likes, articleId); }); }
    function updateLikeButton(likes, articleId) { const likeButton = document.getElementById('like-button'); const likeCountSpan = document.getElementById('like-count'); likeCountSpan.textContent = likes; const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true'; if (alreadyLiked) { likeButton.classList.add('liked'); likeButton.querySelector('.heart-icon').textContent = '♥'; } else { likeButton.classList.remove('liked'); likeButton.querySelector('.heart-icon').textContent = '♡'; } likeButton.disabled = false; likeButton.onclick = () => { const currentLikesRef = database.ref(`articles/${articleId}/likes`); if (localStorage.getItem(`liked_${articleId}`) === 'true') { localStorage.removeItem(`liked_${articleId}`); currentLikesRef.set(firebase.database.ServerValue.increment(-1)); } else { localStorage.setItem(`liked_${articleId}`, 'true'); currentLikesRef.set(firebase.database.ServerValue.increment(1)); } }; }
    function listenForComments(articleId) { const commentsList = document.getElementById('comments-list'); commentsListener = database.ref(`comments/${articleId}`).orderByChild('timestamp'); commentsListener.on('value', (snapshot) => { const commentsData = snapshot.val(); const comments = commentsData ? Object.values(commentsData) : []; loadComments(comments.reverse(), commentsList); }); }
    function addComment(author, message) { const commentsRef = database.ref(`comments/${currentArticle.id}`); const newCommentRef = commentsRef.push(); newCommentRef.set({ author: author, message: message, timestamp: firebase.database.ServerValue.TIMESTAMP }); }
    function loadComments(comments, commentsList) { commentsList.innerHTML = ''; if (comments.length === 0) { commentsList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>'; } else { comments.forEach(comment => { const commentEl = document.createElement('div'); commentEl.className = 'comment'; commentEl.innerHTML = `<div class="comment-header"><span class="comment-author">${comment.author || 'Anonim'}</span><span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span></div><p class="comment-message">${comment.message || ''}</p>`; commentsList.appendChild(commentEl); }); } }
    const commentForm = document.getElementById('comment-form'); commentForm.onsubmit = (e) => { e.preventDefault(); const nameInput = document.getElementById('comment-name'); const messageInput = document.getElementById('comment-message'); if (nameInput.value && messageInput.value) { addComment(nameInput.value, messageInput.value); commentForm.reset(); } };
    function showEditor(article = null) { if (!loggedIn) return; const editorForm = document.getElementById('editor-form'); const editorDeleteButton = document.getElementById('editor-delete'); if (article) { editorForm.querySelector('#editor-id').value = article.id; editorForm.querySelector('#editor-order').value = article.order || 99; editorForm.querySelector('#editor-date').value = article.date || new Date().toLocaleString(); editorForm.querySelector('#editor-title').value = article.title || ''; editorForm.querySelector('#editor-author').value = article.author || ''; editorForm.querySelector('#editor-thumbnail').value = article.thumbnail || ''; editorForm.querySelector('#editor-featured').checked = article.featured || false; editorForm.querySelector('#editor-content').value = article.content || ''; editorDeleteButton.classList.remove('hidden'); } else { editorForm.reset(); const newId = Date.now(); editorForm.querySelector('#editor-id').value = newId; editorForm.querySelector('#editor-date').value = new Date().toLocaleString(); editorDeleteButton.classList.add('hidden'); } editorView.classList.remove('hidden'); }
    editorForm.addEventListener('submit', (e) => { e.preventDefault(); const articleId = document.getElementById('editor-id').value; const articleData = { id: parseInt(articleId), order: parseInt(document.getElementById('editor-order').value), date: document.getElementById('editor-date').value, title: document.getElementById('editor-title').value, author: document.getElementById('editor-author').value, thumbnail: document.getElementById('editor-thumbnail').value, featured: document.getElementById('editor-featured').checked, content: document.getElementById('editor-content').value, }; database.ref(`content/${articleId}`).set(articleData).then(() => { alert("Artykuł zapisany!"); editorView.classList.add('hidden'); }).catch(err => { console.error(err); alert("Błąd zapisu! Upewnij się, że jesteś zalogowany i masz uprawnienia."); }); });
    editorCancelButton.addEventListener('click', () => editorView.classList.add('hidden'));
    editorDeleteButton.addEventListener('click', () => { const articleId = document.getElementById('editor-id').value; if (confirm(`Czy na pewno chcesz usunąć artykuł ID: ${articleId}?`)) { database.ref(`content/${articleId}`).remove().then(() => { alert("Artykuł usunięty."); editorView.classList.add('hidden'); }).catch(err => { console.error(err); alert("Błąd usuwania!"); }); } });
    function showMainView() { articleView.classList.add('hidden'); mainView.classList.remove('hidden'); backButton.classList.add('hidden'); if (backButton.offsetWidth > 0) { navTitle.style.marginLeft = `-${backButton.offsetWidth}px`; } startSlideInterval(); currentArticle = null; }
    function displayNewsList(articles) { newsListView.innerHTML = ''; articles.forEach(article => { const card = document.createElement('div'); card.className = 'article-card'; card.dataset.id = article.id; card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`; newsListView.appendChild(card); }); }
    function setupFeaturedSlider(articles) { if (articles.length === 0) { featuredSliderContainer.style.display = 'none'; return; } featuredSliderContainer.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`; const sliderContent = featuredSliderContainer.querySelector('.slider-content'); const sliderNav = featuredSliderContainer.querySelector('.slider-nav'); articles.forEach((article, index) => { const slide = document.createElement('div'); slide.className = 'slide'; slide.dataset.id = article.id; slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`; sliderContent.appendChild(slide); const navDot = document.createElement('span'); navDot.className = 'nav-dot'; navDot.dataset.index = index; sliderNav.appendChild(navDot); }); showSlide(0); startSlideInterval(); sliderNav.addEventListener('click', (e) => { if (e.target.classList.contains('nav-dot')) { const index = parseInt(e.target.dataset.index, 10); showSlide(index); resetSlideInterval(); } }); }
    function showSlide(index) { const slides = featuredSliderContainer.querySelectorAll('.slide'); const dots = featuredSliderContainer.querySelectorAll('.nav-dot'); if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1; slides.forEach(slide => slide.classList.remove('active')); dots.forEach(dot => dot.classList.remove('active')); if (slides[index]) slides[index].classList.add('active'); if (dots[index]) dots[index].classList.add('active'); currentSlideIndex = index; }
    function nextSlide() { showSlide(currentSlideIndex + 1); }
    function startSlideInterval() { clearInterval(slideInterval); slideInterval = setInterval(nextSlide, 8000); }
    function resetSlideInterval() { clearInterval(slideInterval); startSlideInterval(); }
    
    // === 8. INICJALIZACJA APLIKACJI ===
    function init() {
        backButton.addEventListener('click', () => { if (commentsListener) commentsListener.off(); showMainView(); });
        function handleArticleClick(event) {
            const targetElement = event.target.closest('[data-id]');
            if (targetElement) {
                if (loggedIn) {
                    const articleToEdit = allArticles.find(a => a.id == targetElement.dataset.id);
                    showEditor(articleToEdit);
                } else {
                    displayArticle(targetElement.dataset.id);
                }
                window.scrollTo(0, 0);
            }
        }
        featuredSliderContainer.addEventListener('click', handleArticleClick);
        newsListView.addEventListener('click', handleArticleClick);
        loadArticlesFromFirebase();
    }

    init();
});
// DODAJ TE DWIE FUNKCJE

// Twoja stara, działająca funkcja udostępniania
function setupShareButton(article) {
    const shareButton = document.getElementById('share-button');
    shareButton.onclick = async () => {
        const shareData = {
            title: article.title,
            text: `Sprawdź ten artykuł: ${article.title}`,
            url: `${window.location.origin}${window.location.pathname}#article-${article.id}`
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareData.url);
                alert('Link do artykułu skopiowany do schowka!');
            } else {
                throw new Error('APIs not supported');
            }
        } catch (err) {
            console.warn("Automatyczne udostępnianie/kopiowanie nie powiodło się:", err);
            window.prompt("Skopiuj ten link ręcznie:", shareData.url);
        }
    };
}

// Nowa funkcja do otwierania artykułów z linku
function handleDeepLink() {
    const hash = window.location.hash; // Pobiera np. #article-4
    if (hash && hash.startsWith('#article-')) {
        const articleId = hash.substring(9); // Wyciąga samo "4"
        // Poczekaj chwilę, aż artykuły się załadują z Firebase
        setTimeout(() => {
            if (articleId && allArticles.some(a => a.id == articleId)) {
                displayArticle(articleId);
            }
        }, 500); // 0.5s opóźnienia powinno wystarczyć
    }
}
