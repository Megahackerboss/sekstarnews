/**
 * Główny skrypt aplikacji Sekstar News.
 * Ostateczna, stabilna wersja z poprawnym zarządzaniem stanem.
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
    // === 2. ELEMENTY DOM =============================================
    // =================================================================

   const elements = {
    navTitle: document.querySelector('.nav-title'),
    backButton: document.getElementById('back-button'),
    views: { main: document.getElementById('main-view'), article: document.getElementById('article-view'), editor: document.getElementById('editor-view') },
    slider: { container: document.getElementById('featured-slider-container') },
    newsList: document.getElementById('news-list-view'),
    articleDetail: { date: document.getElementById('article-date'), author: document.getElementById('article-author'), content: document.getElementById('article-content'), likeButton: document.getElementById('like-button'), likeCount: document.getElementById('like-count'), shareButton: document.getElementById('share-button') },
    commentSection: { form: document.getElementById('comment-form'), nameInput: document.getElementById('comment-name'), messageInput: document.getElementById('comment-message'), list: document.getElementById('comments-list'), formatItalicBtn: document.getElementById('format-italic-btn') },
    editorForm: { form: document.getElementById('editor-form'), idInput: document.getElementById('editor-id'), orderInput: document.getElementById('editor-order'), dateInput: document.getElementById('editor-date'), titleInput: document.getElementById('editor-title'), authorInput: document.getElementById('editor-author'), thumbnailInput: document.getElementById('editor-thumbnail'), featuredCheckbox: document.getElementById('editor-featured'), contentInput: document.getElementById('editor-content'), cancelButton: document.getElementById('editor-cancel'), deleteButton: document.getElementById('editor-delete') },
    loadMoreArticlesBtn: document.getElementById('load-more-articles-btn'),
    loadMoreCommentsBtn: document.getElementById('load-more-comments-btn'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    
    // Nowe elementy panelu użytkownika
    userPanel: {
        button: document.getElementById('user-panel-button'),
        view: document.getElementById('user-panel-view'),
        infoView: document.getElementById('user-info-view'),
        authView: document.getElementById('auth-view'),
        nickSpan: document.getElementById('user-info-nick'),
        addArticleBtn: document.getElementById('user-panel-add-article'),
        logoutBtn: document.getElementById('user-panel-logout'),
        cancelBtn: document.getElementById('user-panel-cancel'),
        showLoginTab: document.getElementById('show-login-tab'),
        showRegisterTab: document.getElementById('show-register-tab'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginEmail: document.getElementById('login-email'),
        loginPassword: document.getElementById('login-password'),
        registerNick: document.getElementById('register-nick'),
        registerEmail: document.getElementById('register-email'),
        registerPassword: document.getElementById('register-password'),
        authCancelBtn: document.getElementById('auth-cancel-button'),
            // DODAJ TE NOWE ELEMENTY
        showInfoTab: document.getElementById('show-info-tab'),
        showPermsTab: document.getElementById('show-perms-tab'),
        profileInfoContent: document.getElementById('profile-info-content'),
        profilePermsContent: document.getElementById('profile-perms-content'),
        profileInfoForm: document.getElementById('profile-info-form'),
        profileNickInput: document.getElementById('profile-nick-input'),
        profileEmailInput: document.getElementById('profile-email-input'),
            // DODAJ TĘ LINIĘ
        resetPasswordBtn: document.getElementById('profile-reset-password-button')
    }
};

    // =================================================================
    // === 3. STAN APLIKACJI ===========================================
    // =================================================================

 let state = { allArticlesMeta: [], lastLoadedArticleOrder: null, areAllArticlesLoaded: false, allComments: [], displayedComments: [], areAllCommentsLoaded: false, currentArticle: null, isUserAdmin: false, activeCommentsRef: null, sliderInterval: null, currentSlideIndex: 0, currentUser: null, localUserId: null }; // Zostawiamy localUserId!
    
    // =================================================================
    // === 4. LOGIKA UI (POPRAWIONA) =====================================
    // =================================================================
    
    function showView(viewToShow) { Object.values(elements.views).forEach(view => view.classList.add('hidden')); if (viewToShow) viewToShow.classList.remove('hidden'); }
    function showMainView() { showView(elements.views.main); elements.backButton.classList.add('hidden'); elements.navTitle.style.marginLeft = '0px'; startSlideInterval(); state.currentArticle = null; if (window.location.hash) window.location.hash = ''; }
    function displayNewsList(articles) { elements.newsList.innerHTML = ''; articles.forEach(article => { const card = document.createElement('div'); card.className = 'article-card'; card.dataset.id = article.id; card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`; elements.newsList.appendChild(card); }); }
    async function displayArticle(articleId) { let articleMeta = state.allArticlesMeta.find(a => a.id == articleId); if (!articleMeta) { try { const snapshot = await database.ref(`articles_meta/${articleId}`).once('value'); articleMeta = snapshot.val(); if (!articleMeta) { showMainView(); return; } state.allArticlesMeta.push(articleMeta); } catch (error) { showMainView(); return; } } state.currentArticle = articleMeta; if (state.commentsListener) state.commentsListener.off(); elements.articleDetail.date.textContent = articleMeta.date; elements.articleDetail.author.textContent = `Autor: ${articleMeta.author}`; elements.articleDetail.content.innerHTML = '<p>Ładowanie treści...</p>'; showView(elements.views.article); elements.backButton.classList.remove('hidden'); elements.navTitle.style.marginLeft = '0px'; clearInterval(state.sliderInterval); const cachedArticle = JSON.parse(localStorage.getItem(`article_${articleId}`)); if (cachedArticle && cachedArticle.lastUpdated >= articleMeta.lastUpdated) { elements.articleDetail.content.innerHTML = cachedArticle.content; } else { database.ref(`articles_content/${articleId}`).once('value', (snapshot) => { const articleContent = snapshot.val(); if (articleContent) { elements.articleDetail.content.innerHTML = articleContent.content; localStorage.setItem(`article_${articleId}`, JSON.stringify({ content: articleContent.content, lastUpdated: articleMeta.lastUpdated })); } }); } state.allComments = []; state.areAllCommentsLoaded = false; listenForComments(articleId); setupLikes(articleId); setupShareButton(articleMeta); }
    function renderComments(comments) { const commentListContainer = elements.commentSection.list; commentListContainer.innerHTML = ''; if (comments.length === 0) { commentListContainer.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>'; return; } comments.forEach(comment => { const commentEl = document.createElement('div'); commentEl.className = 'comment'; commentEl.dataset.commentId = comment.commentId; let controls = ''; if (state.isUserAdmin || comment.userId === state.localUserId) { controls = `<div class="comment-controls"><button class="edit-comment-btn">Edytuj</button><button class="delete-comment-btn">Usuń</button></div>`; } commentEl.innerHTML = `<div class="comment-header"><span class="comment-author">${comment.author || 'Anonim'}</span><span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span></div><p class="comment-message">${parseCommentFormatting(comment.message || '')}</p>${controls}`; commentListContainer.appendChild(commentEl); }); }
    function setupFeaturedSlider(articles) { if (articles.length === 0) { elements.slider.container.style.display = 'none'; return; } elements.slider.container.style.display = 'block'; elements.slider.container.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`; const content = elements.slider.container.querySelector('.slider-content'); const nav = elements.slider.container.querySelector('.slider-nav'); articles.forEach((article, index) => { const slide = document.createElement('div'); slide.className = 'slide'; slide.dataset.id = article.id; slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`; content.appendChild(slide); const navDot = document.createElement('span'); navDot.className = 'nav-dot'; navDot.dataset.index = index; nav.appendChild(navDot); }); showSlide(0); startSlideInterval(); }
    function showSlide(index) { const slides = elements.slider.container.querySelectorAll('.slide'); const dots = elements.slider.container.querySelectorAll('.nav-dot'); if (!slides.length) return; if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1; slides.forEach(s => s.classList.remove('active')); dots.forEach(d => d.classList.remove('active')); if (slides[index]) slides[index].classList.add('active'); if (dots[index]) dots[index].classList.add('active'); state.currentSlideIndex = index; }
    function startSlideInterval() { clearInterval(state.sliderInterval); state.sliderInterval = setInterval(() => showSlide(state.currentSlideIndex + 1), 8000); }
    function showEditor(article = null) { if (!state.isUserAdmin) return; elements.editorForm.form.reset(); if (article) { elements.editorForm.idInput.value = article.id; elements.editorForm.orderInput.value = article.order || 99; elements.editorForm.dateInput.value = article.date || new Date().toLocaleString(); elements.editorForm.titleInput.value = article.title || ''; elements.editorForm.authorInput.value = article.author || ''; elements.editorForm.thumbnailInput.value = article.thumbnail || ''; elements.editorForm.featuredCheckbox.checked = article.featured || false; elements.editorForm.deleteButton.classList.remove('hidden'); database.ref(`articles_content/${article.id}`).once('value', s=>elements.editorForm.contentInput.value=s.val()?s.val().content:''); } else { elements.editorForm.idInput.value = Date.now(); elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL'); elements.editorForm.deleteButton.classList.add('hidden'); } showView(elements.views.editor); }
    function updateLikeButton(likesCount, articleId) { elements.articleDetail.likeCount.textContent = likesCount; const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true'; if (alreadyLiked) { elements.articleDetail.likeButton.classList.add('liked'); elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♥️'; } else { elements.articleDetail.likeButton.classList.remove('liked'); elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♡'; } elements.articleDetail.likeButton.disabled = false; }

    // =================================================================
    // === 5. INTERAKCJE Z FIREBASE =====================================
    // =================================================================
    
   function loadInitialArticles() {
    let query = database.ref('articles_meta').orderByChild('order').limitToFirst(ARTICLES_PER_PAGE);
    query.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            elements.loadMoreArticlesBtn.classList.add('hidden');
            // Nawet jeśli nie ma artykułów, musimy sprawdzić, czy nie ma deeplinka do nieistniejącego artykułu
            handleDeepLink(); 
            return;
        }
        const newArticles = Object.values(data);
        state.allArticlesMeta = newArticles.sort((a, b) => (a.order || 999) - (b.order || 999));
        
        if (state.allArticlesMeta.length > 0) {
            state.lastLoadedArticleOrder = state.allArticlesMeta[state.allArticlesMeta.length - 1].order;
        }

        // KROK 1: Zawsze renderuj listę i slider w tle.
        displayNewsList(state.allArticlesMeta);
        const featured = state.allArticlesMeta.filter(a => a.featured);
        setupFeaturedSlider(featured);

        if (newArticles.length < ARTICLES_PER_PAGE) {
            state.areAllArticlesLoaded = true;
            elements.loadMoreArticlesBtn.classList.add('hidden');
        } else {
            elements.loadMoreArticlesBtn.classList.remove('hidden');
        }

        // KROK 2: Po wyrenderowaniu listy, sprawdź URL i pokaż właściwy widok.
        handleDeepLink();
    });
}
    function loadMoreArticles() { if (state.areAllArticlesLoaded) return; elements.loadMoreArticlesBtn.disabled = true; elements.loadMoreArticlesBtn.textContent = 'Ładowanie...'; let query = database.ref('articles_meta').orderByChild('order').startAfter(state.lastLoadedArticleOrder).limitToFirst(ARTICLES_PER_PAGE); query.once('value', snapshot => { const data = snapshot.val(); if (!data || Object.keys(data).length === 0) { state.areAllArticlesLoaded = true; elements.loadMoreArticlesBtn.classList.add('hidden'); return; } const newArticles = Object.values(data); newArticles.sort((a, b) => (a.order || 999) - (b.order || 999)); state.allArticlesMeta.push(...newArticles); state.lastLoadedArticleOrder = newArticles[newArticles.length - 1].order; displayNewsList(state.allArticlesMeta); elements.loadMoreArticlesBtn.disabled = false; elements.loadMoreArticlesBtn.textContent = 'Wczytaj więcej'; if (newArticles.length < ARTICLES_PER_PAGE) { state.areAllArticlesLoaded = true; elements.loadMoreArticlesBtn.classList.add('hidden'); } }); }
    function listenForComments(articleId) {
    // Jeśli mamy aktywną referencję do komentarzy z POPRZEDNIEGO artykułu, wyłączamy nasłuchiwanie.
    if (state.activeCommentsRef) {
        state.activeCommentsRef.off();
    }

    state.allComments = [];
    state.areAllCommentsLoaded = false;
    elements.loadMoreCommentsBtn.classList.add('hidden');
    
    // Tworzymy nową referencję i ZAPISUJEMY JĄ w stanie aplikacji
    const newCommentsRef = database.ref(`comments/${articleId}`);
    state.activeCommentsRef = newCommentsRef; // <-- Kluczowa zmiana!

    // Używamy nowej referencji do nasłuchiwania
    newCommentsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        state.allComments = data ? Object.entries(data).map(([key, val]) => ({ ...val, commentId: key })).sort((a,b) => b.timestamp - a.timestamp) : [];
        const initialComments = state.allComments.slice(0, COMMENTS_PER_PAGE);
        renderComments(initialComments);
        if (state.allComments.length > COMMENTS_PER_PAGE) {
            elements.loadMoreCommentsBtn.classList.remove('hidden');
        } else {
            elements.loadMoreCommentsBtn.classList.add('hidden');
        }
    });
}
    function loadMoreComments() { const currentlyShown = document.querySelectorAll('#comments-list .comment').length; const nextComments = state.allComments.slice(0, currentlyShown + COMMENTS_PER_PAGE); renderComments(nextComments); if (nextComments.length >= state.allComments.length) { elements.loadMoreCommentsBtn.classList.add('hidden'); } }
    function setupLikes(articleId) { const likesRef = database.ref(`articles/${articleId}/likes`); likesRef.on('value', (snapshot) => updateLikeButton(snapshot.val() || 0, articleId)); }
    async function addComment(author, message) {
    const nickToCheck = author.trim().toLowerCase();
    
    // Sprawdź, czy użytkownik jest zalogowany
    if (state.currentUser) {
        // Jeśli zalogowany użytkownik używa nicku INNEGO niż swój własny
        if (nickToCheck !== state.currentUser.nick.toLowerCase()) {
            const snapshot = await database.ref(`takenNicks/${nickToCheck}`).once('value');
            if (snapshot.exists()) {
                alert("Ten nick jest zarezerwowany przez innego użytkownika. Proszę wybrać inny.");
                return; // Przerwij dodawanie komentarza
            }
        }
    } else {
        // Jeśli użytkownik NIE jest zalogowany, zawsze sprawdzaj nick
        const snapshot = await database.ref(`takenNicks/${nickToCheck}`).once('value');
        if (snapshot.exists()) {
            alert("Ten nick jest zarezerwowany przez innego użytkownika. Proszę wybrać inny.");
            return; // Przerwij dodawanie komentarza
        }
    }

    // Jeśli wszystkie warunki zostały spełnione, dodaj komentarz
    const userIdToSave = state.currentUser ? state.currentUser.uid : state.localUserId;
    database.ref(`comments/${state.currentArticle.id}`).push().set({
        author: author.trim(),
        message,
        userId: userIdToSave,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}
// =================================================================
// === 6. UWIERZYTELNIANIE I ZARZĄDZANIE UŻYTKOWNIKIEM =============
// =================================================================

const ADMIN_UID = '9T148rWC4lOnwBKTtPg9B24Ns1F3'; // UUID Admina

function initializeAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user && !user.isAnonymous) { // Ignorujemy anonimowe logowanie
            // Użytkownik jest zalogowany
            const userProfileRef = database.ref(`users/${user.uid}`);
            const snapshot = await userProfileRef.once('value');
            const profile = snapshot.val();

            state.currentUser = {
                uid: user.uid,
                email: user.email,
                nick: profile ? profile.nick : 'Użytkownik'
            };
            state.isUserAdmin = user.uid === ADMIN_UID;
        } else {
            // Użytkownik jest wylogowany
            state.currentUser = null;
            state.isUserAdmin = false;
        }
        updateUserUI(); // Zaktualizuj interfejs na podstawie stanu logowania
    });
}

// Zastąp starą wersję tą nową
function handleRegistration(e) {
    e.preventDefault();
    const nick = elements.userPanel.registerNick.value.trim();
    const email = elements.userPanel.registerEmail.value.trim();
    const password = elements.userPanel.registerPassword.value;

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const uid = userCredential.user.uid;
            const updates = {};
            // Zapisz profil użytkownika
            updates[`users/${uid}`] = { nick: nick, email: email };
            // Dodaj nick do listy zajętych (używamy małych liter dla spójności)
            updates[`takenNicks/${nick.toLowerCase()}`] = uid;

            database.ref().update(updates); // Wykonaj oba zapisy jednocześnie
            elements.userPanel.view.classList.add('hidden');
        })
        .catch(error => {
            alert(`Błąd rejestracji: ${error.message}`);
        });
}

function handleLogin(e) {
    e.preventDefault();
    const email = elements.userPanel.loginEmail.value;
    const password = elements.userPanel.loginPassword.value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            elements.userPanel.view.classList.add('hidden');
        })
        .catch(error => {
            alert(`Błąd logowania: ${error.message}`);
        });
}

function handleLogout() {
    auth.signOut();
    elements.userPanel.view.classList.add('hidden');
}
// Zastąp starą wersję tą nową
function handleProfileUpdate(e) {
    e.preventDefault();
    const newNick = elements.userPanel.profileNickInput.value.trim();
    const oldNick = state.currentUser.nick;

    if (!newNick) {
        alert("Nick nie może być pusty.");
        return;
    }

    if (state.currentUser && state.currentUser.uid) {
        const updates = {};
        // Zaktualizuj nick w profilu
        updates[`users/${state.currentUser.uid}/nick`] = newNick;
        // Usuń stary nick z listy zajętych
        updates[`takenNicks/${oldNick.toLowerCase()}`] = null;
        // Dodaj nowy nick do listy zajętych
        updates[`takenNicks/${newNick.toLowerCase()}`] = state.currentUser.uid;

        database.ref().update(updates)
            .then(() => {
                state.currentUser.nick = newNick;
                updateUserUI();
                alert("Zapisano zmiany!");
            })
            .catch(error => alert(`Błąd: ${error.message}`));
    }
}
    function handlePasswordReset() {
    if (!state.currentUser || !state.currentUser.email) {
        alert("Nie można zresetować hasła. Brak danych użytkownika.");
        return;
    }

    const email = state.currentUser.email;
    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert(`Na Twój adres ${email} został wysłany email z instrukcją resetowania hasła.`);
            elements.userPanel.view.classList.add('hidden'); // Zamknij panel po wysłaniu
        })
        .catch(error => {
            alert(`Wystąpił błąd: ${error.message}`);
        });
}

// Funkcja aktualizująca wygląd interfejsu w zależności od stanu logowania
// Zastąp starą funkcję updateUserUI tą nową
// Ta funkcja zastępuje całą poprzednią wersję updateUserUI
function updateUserUI() {
    if (state.currentUser) {
        // --- Kod dla UŻYTKOWNIKA ZALOGOWANEGO ---
        elements.userPanel.button.textContent = state.currentUser.nick.charAt(0).toUpperCase();
        elements.userPanel.nickSpan.textContent = state.currentUser.nick;
        elements.userPanel.infoView.classList.remove('hidden');
        elements.userPanel.authView.classList.add('hidden');

        // Wypełnij pola formularza profilu
        elements.userPanel.profileNickInput.value = state.currentUser.nick;
        elements.userPanel.profileEmailInput.value = state.currentUser.email;
        
        // Pokaż przycisk dodawania artykułu, jeśli to admin
        if (state.isUserAdmin) {
            elements.userPanel.addArticleBtn.classList.remove('hidden');
        } else {
            elements.userPanel.addArticleBtn.classList.add('hidden');
        }

        // Wypełnij pole nicku w komentarzach i upewnij się, że nie jest zablokowane
        elements.commentSection.nameInput.value = state.currentUser.nick;
        elements.commentSection.nameInput.disabled = false;

    } else {
        // --- Kod dla UŻYTKOWNIKA NIEZALOGOWANEGO ---
        elements.userPanel.button.textContent = '?';
        elements.userPanel.infoView.classList.add('hidden');
        elements.userPanel.authView.classList.remove('hidden');

        // Wyczyść pole nicku w komentarzach i upewnij się, że nie jest zablokowane
        elements.commentSection.nameInput.value = '';
        elements.commentSection.nameInput.disabled = false;
    }
}
    // =================================================================
    // ====== 7. punkt ================================================
    // =================================================================
    
    function getOrCreateLocalUserId() { let userId = localStorage.getItem('localUserId'); if (!userId) { userId = `user_${Math.random().toString(36).substr(2, 9)}`; localStorage.setItem('localUserId', userId); } return userId; }
    function setupShareButton(article) { if (!article || !article.id) return; elements.articleDetail.shareButton.onclick = async () => { const shareData = { title: article.title, text: `Sprawdź ten artykuł z Sekstar News: ${article.title}`, url: `${window.location.origin}${window.location.pathname}#article-${article.id}` }; try { if (navigator.share) await navigator.share(shareData); else if (navigator.clipboard) { await navigator.clipboard.writeText(shareData.url); alert('Link skopiowany!'); } else throw new Error('No share API'); } catch (err) { window.prompt("Skopiuj ten link:", shareData.url); } }; }
    function handleDeepLink() { const hash = window.location.hash; if (hash && hash.startsWith('#article-')) { const articleId = hash.substring(9); displayArticle(articleId); } else { showMainView(); } }
    function parseCommentFormatting(text) { let safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); safeText = safeText.replace(/\*(.*?)\*/g, '<i>$1</i>'); return safeText; }
    
    // =================================================================
    // === 8. GŁÓWNY MENEDŻER ZDARZEŃ (DELEGACJA) ======================
    // =================================================================
    
    function bindEventListeners() {
        document.body.addEventListener('click', (event) => {
            const target = event.target;
            
            // --- Główne przyciski i nawigacja ---
        if (target.id === 'back-button' || target.closest('#back-button')) {
    // Sprawdzamy, czy istnieje aktywna referencja i wyłączamy nasłuchiwanie
    if (state.activeCommentsRef) {
        state.activeCommentsRef.off();
        state.activeCommentsRef = null; // Czyścimy stan po powrocie
    }
    showMainView();
    return;
}
            if (target.id === 'load-more-articles-btn') { loadMoreArticles(); return; }
            if (target.id === 'load-more-comments-btn') { loadMoreComments(); return; }
            if (target.id === 'clear-cache-btn') { let c=0; for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i); if(k&&k.startsWith('article_')){localStorage.removeItem(k);c++;}} alert(`Wyczyszczono ${c} artykułów.`); return; }

            // --- Logowanie i panel admina ---
            // Wewnątrz funkcji bindEventListeners()

// --- Panel Użytkownika, Logowanie i Rejestracja ---
            if (target.id === 'user-panel-button' || target.closest('#user-panel-button')) {
                elements.userPanel.view.classList.remove('hidden');
                // Przy otwarciu panelu zawsze wracaj do domyślnej zakładki
                if (state.currentUser) {
                    elements.userPanel.profileInfoContent.classList.remove('hidden');
                    elements.userPanel.profilePermsContent.classList.add('hidden');
                    elements.userPanel.showInfoTab.classList.add('active');
                    elements.userPanel.showPermsTab.classList.remove('active');
                }
                return;
            }
            if (target.id === 'user-panel-add-article') {
                showEditor(null);
                elements.userPanel.view.classList.add('hidden');
                return;
            }
            if (target.id === 'user-panel-logout') {
                handleLogout();
                return;
            }
            // DODAJ TEN FRAGMENT
           if (target.id === 'profile-reset-password-button') {
                handlePasswordReset();
               return;
            }
            if (target.id === 'user-panel-cancel' || target.id === 'auth-cancel-button') {
                elements.userPanel.view.classList.add('hidden');
                return;
            }
            // Obsługa zakładek Logowanie / Rejestracja
            if (target.id === 'show-login-tab') {
                elements.userPanel.loginForm.classList.remove('hidden');
                elements.userPanel.registerForm.classList.add('hidden');
                elements.userPanel.showLoginTab.classList.add('active');
                elements.userPanel.showRegisterTab.classList.remove('active');
                return;
            }
            if (target.id === 'show-register-tab') {
                elements.userPanel.loginForm.classList.add('hidden');
                elements.userPanel.registerForm.classList.remove('hidden');
                elements.userPanel.showLoginTab.classList.remove('active');
                elements.userPanel.showRegisterTab.classList.add('active');
                return;
            }
            // NOWA SEKCJA: Obsługa zakładek Profilu (Informacje / Uprawnienia)
            if (target.id === 'show-info-tab') {
                elements.userPanel.profileInfoContent.classList.remove('hidden');
                elements.userPanel.profilePermsContent.classList.add('hidden');
                elements.userPanel.showInfoTab.classList.add('active');
                elements.userPanel.showPermsTab.classList.remove('active');
                return;
            }
            if (target.id === 'show-perms-tab') {
                elements.userPanel.profileInfoContent.classList.add('hidden');
                elements.userPanel.profilePermsContent.classList.remove('hidden');
                elements.userPanel.showInfoTab.classList.remove('active');
                elements.userPanel.showPermsTab.classList.add('active');
                return;
            }

            // --- Edytor Artykułów ---
            if (target.id === 'editor-cancel') { showMainView(); return; }
            if (target.id === 'editor-delete') { const articleId = elements.editorForm.idInput.value; if (confirm(`Usunąć artykuł ID: ${articleId}?`)) { const updates = {}; updates[`/articles_meta/${articleId}`] = null; updates[`/articles_content/${articleId}`] = null; database.ref().update(updates).then(() => { alert("Artykuł usunięty."); showMainView(); }); } return; }

            // --- Interakcje z artykułami i komentarzami ---
            const articleCard = target.closest('[data-id]');
            if (articleCard) {
                if (state.isUserAdmin && (target.closest('#news-list-view') || target.closest('#featured-slider-container'))) {
                    const articleToEdit = state.allArticlesMeta.find(a => a.id == articleCard.dataset.id);
                    showEditor(articleToEdit);
                } else {
                    window.location.hash = `article-${articleCard.dataset.id}`;
                }
                window.scrollTo(0, 0);
                return;
            }

            const commentEl = target.closest('.comment');
            if (commentEl) {
                const commentId = commentEl.dataset.commentId;
                if (target.classList.contains('delete-comment-btn')) { if (confirm("Usunąć komentarz?")) { database.ref(`comments/${state.currentArticle.id}/${commentId}`).remove(); } return; }
                if (target.classList.contains('edit-comment-btn')) {
                    const commentData = state.allComments.find(c => c.commentId === commentId);
                    const messageP = commentEl.querySelector('.comment-message');
                    const controlsDiv = commentEl.querySelector('.comment-controls');
                    const editInput = document.createElement('textarea'); editInput.className = 'comment-edit-textarea'; editInput.value = commentData.message;
                    const saveBtn = document.createElement('button'); saveBtn.textContent = 'Zapisz';
                    const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Anuluj';
                    messageP.style.display = 'none'; controlsDiv.style.display = 'none';
                    commentEl.appendChild(editInput); commentEl.appendChild(saveBtn); commentEl.appendChild(cancelBtn);
                    editInput.focus();
                    saveBtn.onclick = () => { const newText = editInput.value.trim(); if (newText) { database.ref(`comments/${state.currentArticle.id}/${commentId}/message`).set(newText); } };
                    cancelBtn.onclick = () => { messageP.style.display = ''; controlsDiv.style.display = ''; editInput.remove(); saveBtn.remove(); cancelBtn.remove(); };
                }
            }
            
            // --- Kliknięcie na polubienie ---
            if (target.id === 'like-button' || target.closest('#like-button')) {
                const liked = localStorage.getItem(`liked_${state.currentArticle.id}`) === 'true';
                const likesRef = database.ref(`articles/${state.currentArticle.id}/likes`);
                if (liked) { localStorage.removeItem(`liked_${state.currentArticle.id}`); likesRef.set(firebase.database.ServerValue.increment(-1)); } 
                else { localStorage.setItem(`liked_${state.currentArticle.id}`, 'true'); likesRef.set(firebase.database.ServerValue.increment(1)); }
            }
        });

        // --- Zdarzenia formularzy i inne ---
        elements.userPanel.profileInfoForm.addEventListener('submit', handleProfileUpdate);
        elements.userPanel.loginForm.addEventListener('submit', handleLogin);
        elements.userPanel.registerForm.addEventListener('submit', handleRegistration);
        elements.commentSection.form.addEventListener('submit', (e) => { e.preventDefault(); const name = elements.commentSection.nameInput.value.trim(); const message = elements.commentSection.messageInput.value.trim(); if (name && message) { addComment(name, message); elements.commentSection.form.reset(); } });
        elements.editorForm.form.addEventListener('submit', (e) => { e.preventDefault(); const articleId = elements.editorForm.idInput.value; const timestamp = Date.now(); const metaData = { id: parseInt(articleId), order: parseInt(elements.editorForm.orderInput.value), date: elements.editorForm.dateInput.value, title: elements.editorForm.titleInput.value, author: elements.editorForm.authorInput.value, thumbnail: elements.editorForm.thumbnailInput.value, featured: elements.editorForm.featuredCheckbox.checked, lastUpdated: timestamp }; const contentData = { content: elements.editorForm.contentInput.value }; const updates = {}; updates[`/articles_meta/${articleId}`] = metaData; updates[`/articles_content/${articleId}`] = contentData; database.ref().update(updates).then(() => { alert("Artykuł zapisany!"); showMainView(); }); });
        window.addEventListener('hashchange', handleDeepLink);
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
    
    init();
});









