/**
 * Główny skrypt aplikacji Sekstar News.
 * Wersja z logowaniem diagnostycznym.
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

    // =================================================================
    // === 2. ELEMENTY DOM =============================================
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
            commentEditor: document.getElementById('comment-editor-view'),
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
        commentEditor: {
            textarea: document.getElementById('comment-editor-textarea'),
            saveButton: document.getElementById('comment-editor-save'),
            cancelButton: document.getElementById('comment-editor-cancel'),
        },
        loginForm: { /* ... (bez zmian) ... */ },
        editorForm: { /* ... (bez zmian) ... */ }
    };
    // Uzupełnienie reszty elementów DOM, które mogły zostać pominięte
    elements.loginForm = {
        emailInput: document.getElementById('login-email'),
        passwordInput: document.getElementById('login-password'),
        submitButton: document.getElementById('login-submit'),
        cancelButton: document.getElementById('login-cancel'),
    };
    elements.editorForm = {
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
    };


    // =================================================================
    // === 3. STAN APLIKACJI ===========================================
    // =================================================================

    let state = {
        allArticles: [],
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
    
    function showView(viewToShow) {
        Object.values(elements.views).forEach(view => view.classList.add('hidden'));
        if (viewToShow) viewToShow.classList.remove('hidden');
    }
    
    function showMainView() {
        showView(elements.views.main);
        elements.backButton.classList.add('hidden');
        elements.navTitle.style.marginLeft = '50%';
        startSlideInterval();
        state.currentArticle = null;
        if (window.location.hash) window.location.hash = '';
    }
    
    function displayArticle(articleId) {
        const article = state.allArticles.find(a => a.id == articleId);
        if (!article) {
            console.error(`DIAGNOSTYKA: Nie znaleziono artykułu o ID: ${articleId}`);
            showMainView();
            return;
        }
        
        state.currentArticle = article;
        // DIAGNOSTYKA
        console.log("DIAGNOSTYKA: Wyświetlono artykuł. Stan 'currentArticle' ustawiony na:", state.currentArticle);
        
        if (state.commentsListener) state.commentsListener.off();

        elements.articleDetail.date.textContent = article.date;
        elements.articleDetail.author.textContent = `Autor: ${article.author}`;
        elements.articleDetail.content.innerHTML = article.content;

        showView(elements.views.article);
        elements.backButton.classList.remove('hidden');
        elements.navTitle.style.marginLeft = '0px';
        clearInterval(state.sliderInterval);

        setupLikes(article.id);
        listenForComments(article.id);
        setupShareButton(article);
    }
    
    // ZNAJDŹ I ZASTĄP TĘ FUNKCJĘ
// ZNAJDŹ I ZASTĄP TĘ FUNKCJĘ
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

    // Podmień całą zawartość listy komentarzy za jednym razem
    commentListContainer.innerHTML = '';
    commentListContainer.appendChild(newList);
    
    // --- NOWA, POPRAWIONA LOGIKA NASŁUCHIWANIA ---
    
    // Usuń stary nasłuchiwacz, jeśli istnieje, aby uniknąć duplikatów
    if (commentListContainer.eventListener) {
        commentListContainer.removeEventListener('click', commentListContainer.eventListener);
    }

    // Stwórz nową funkcję nasłuchującą
    const eventHandler = (event) => {
        const target = event.target;
        const commentEl = target.closest('.comment');
        if (!commentEl) return;

        const commentId = commentEl.dataset.commentId;
        
        // Obsługa przycisku "USUŃ"
        if (target.classList.contains('delete-comment-btn')) {
            if (confirm("Czy na pewno chcesz usunąć ten komentarz?")) {
                database.ref(`comments/${state.currentArticle.id}/${commentId}`).remove();
            }
        }

        // Obsługa przycisku "EDYTUJ"
        if (target.classList.contains('edit-comment-btn')) {
            const commentData = comments.find(c => c.commentId === commentId);
            const messageP = commentEl.querySelector('.comment-message');
            const controlsDiv = commentEl.querySelector('.comment-controls');
            
            const editInput = document.createElement('textarea');
            editInput.className = 'comment-edit-textarea';
            editInput.value = commentData.message;

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Zapisz';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Anuluj';

            messageP.style.display = 'none';
            controlsDiv.style.display = 'none';
            commentEl.appendChild(editInput);
            commentEl.appendChild(saveBtn);
            commentEl.appendChild(cancelBtn);
            editInput.focus();

            saveBtn.onclick = () => {
                const newText = editInput.value.trim();
                if (newText) {
                    database.ref(`comments/${state.currentArticle.id}/${commentId}/message`).set(newText);
                }
            };

            cancelBtn.onclick = () => {
                messageP.style.display = '';
                controlsDiv.style.display = '';
                editInput.remove();
                saveBtn.remove();
                cancelBtn.remove();
            };
        }
    };

    // Dodaj nowy nasłuchiwacz i zapamiętaj go, aby móc go usunąć później
    commentListContainer.addEventListener('click', eventHandler);
    commentListContainer.eventListener = eventHandler;
}
    // Pozostałe funkcje UI (setupFeaturedSlider, displayNewsList, etc.) bez zmian...
    function displayNewsList(articles) { elements.newsList.innerHTML = ''; articles.forEach(article => { const card = document.createElement('div'); card.className = 'article-card'; card.dataset.id = article.id; card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`; elements.newsList.appendChild(card); }); }
    function setupFeaturedSlider(articles) { if (articles.length === 0) { elements.slider.container.style.display = 'none'; return; } elements.slider.container.style.display = 'block'; elements.slider.container.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`; const content = elements.slider.container.querySelector('.slider-content'); const nav = elements.slider.container.querySelector('.slider-nav'); articles.forEach((article, index) => { const slide = document.createElement('div'); slide.className = 'slide'; slide.dataset.id = article.id; slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`; content.appendChild(slide); const navDot = document.createElement('span'); navDot.className = 'nav-dot'; navDot.dataset.index = index; nav.appendChild(navDot); }); showSlide(0); startSlideInterval(); }
    function showSlide(index) { const slides = elements.slider.container.querySelectorAll('.slide'); const dots = elements.slider.container.querySelectorAll('.nav-dot'); if (!slides.length) return; if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1; slides.forEach(s => s.classList.remove('active')); dots.forEach(d => d.classList.remove('active')); if (slides[index]) slides[index].classList.add('active'); if (dots[index]) dots[index].classList.add('active'); state.currentSlideIndex = index; }
    function startSlideInterval() { clearInterval(state.sliderInterval); state.sliderInterval = setInterval(() => showSlide(state.currentSlideIndex + 1), 8000); }
    function showEditor(article = null) { if (!state.isUserAdmin) return; elements.editorForm.form.reset(); if (article) { elements.editorForm.idInput.value = article.id; elements.editorForm.orderInput.value = article.order || 99; elements.editorForm.dateInput.value = article.date || new Date().toLocaleString(); elements.editorForm.titleInput.value = article.title || ''; elements.editorForm.authorInput.value = article.author || ''; elements.editorForm.thumbnailInput.value = article.thumbnail || ''; elements.editorForm.featuredCheckbox.checked = article.featured || false; elements.editorForm.contentInput.value = article.content || ''; elements.editorForm.deleteButton.classList.remove('hidden'); } else { elements.editorForm.idInput.value = Date.now(); elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL'); elements.editorForm.deleteButton.classList.add('hidden'); } showView(elements.views.editor); }
    function showCommentEditor(comment) { elements.commentEditor.textarea.value = comment.message; showView(elements.views.commentEditor); elements.commentEditor.saveButton.onclick = () => { const newText = elements.commentEditor.textarea.value.trim(); if (newText) { database.ref(`comments/${state.currentArticle.id}/${comment.commentId}/message`).set(newText); showView(elements.views.article); } }; elements.commentEditor.cancelButton.onclick = () => showView(elements.views.article); }
    function updateLikeButton(likesCount, articleId) { elements.articleDetail.likeCount.textContent = likesCount; const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true'; if (alreadyLiked) { elements.articleDetail.likeButton.classList.add('liked'); elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♥️'; } else { elements.articleDetail.likeButton.classList.remove('liked'); elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♡'; } elements.articleDetail.likeButton.disabled = false; }


    // =================================================================
    // === 5. INTERAKCJE Z FIREBASE =====================================
    // =================================================================
    
    function loadArticlesFromFirebase() { database.ref('content').on('value', (snapshot) => { const data = snapshot.val(); state.allArticles = data ? Object.values(data) : []; state.allArticles.sort((a, b) => (a.order || 999) - (b.order || 999)); const featured = state.allArticles.filter(a => a.featured).slice(0, 5); displayNewsList(state.allArticles); setupFeaturedSlider(featured); handleDeepLink(); }); }
    function setupLikes(articleId) { const likesRef = database.ref(`articles/${articleId}/likes`); likesRef.on('value', (snapshot) => updateLikeButton(snapshot.val() || 0, articleId)); elements.articleDetail.likeButton.onclick = () => { const liked = localStorage.getItem(`liked_${articleId}`) === 'true'; if (liked) { localStorage.removeItem(`liked_${articleId}`); likesRef.set(firebase.database.ServerValue.increment(-1)); } else { localStorage.setItem(`liked_${articleId}`, 'true'); likesRef.set(firebase.database.ServerValue.increment(1)); } }; }
    function listenForComments(articleId) { state.commentsListener = database.ref(`comments/${articleId}`).orderByChild('timestamp'); state.commentsListener.on('value', (snapshot) => { const data = snapshot.val(); const comments = data ? Object.entries(data).map(([key, val]) => ({ ...val, commentId: key })) : []; renderComments(comments.reverse()); }); }

    function addComment(author, message) {
        // DIAGNOSTYKA
        console.log("DIAGNOSTYKA: Próba dodania komentarza. Stan 'currentArticle':", state.currentArticle, "Stan 'localUserId':", state.localUserId);
        
        if (!state.currentArticle || !state.currentArticle.id || !state.localUserId) {
            console.error("DIAGNOSTYKA: Anulowano dodanie komentarza! Brak 'currentArticle' lub 'localUserId'.");
            alert("Wystąpił błąd przy dodawaniu komentarza. Odśwież stronę i spróbuj ponownie.");
            return;
        }
        
        database.ref(`comments/${state.currentArticle.id}`).push().set({
            author: author,
            message: message,
            userId: state.localUserId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            console.log("DIAGNOSTYKA: Komentarz pomyślnie zapisany w Firebase.");
        }).catch(err => {
            console.error("DIAGNOSTYKA: Błąd zapisu komentarza w Firebase:", err);
        });
    }

    // =================================================================
    // === 6. UWIERZYTELNIANIE =========================================
    // =================================================================
    
    function initializeAuth() { auth.onAuthStateChanged(user => { state.isUserAdmin = user && !user.isAnonymous; elements.adminButton.textContent = state.isUserAdmin ? "≡" : "?"; if (!user) auth.signInAnonymously().catch(err => console.error("Błąd logowania anonimowego:", err)); }); }
    function handleAdminLogin() { const email = elements.loginForm.emailInput.value; const pass = elements.loginForm.passwordInput.value; auth.signInWithEmailAndPassword(email, pass).then(() => showView(null)).catch(err => alert(`Błąd logowania: ${err.message}`)); }


    // =================================================================
    // === 7. FUNKCJE POMOCNICZE ========================================
    // =================================================================
    
    function getOrCreateLocalUserId() {
        let userId = localStorage.getItem('localUserId');
        if (!userId) {
            userId = `user_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('localUserId', userId);
        }
        return userId;
    }
    
    function setupShareButton(article) {
        // DIAGNOSTYKA
        console.log("DIAGNOSTYKA: Ustawianie przycisku udostępniania dla artykułu:", article);
        if (!article || !article.id) {
            console.error("DIAGNOSTYKA: Przerwano ustawianie przycisku - brak danych artykułu!");
            return;
        }

        elements.articleDetail.shareButton.onclick = async () => {
            // DIAGNOSTYKA
            console.log("DIAGNOSTYKA: Przycisk Udostępnij KLIKNIĘTY.");
            const shareData = {
                title: article.title,
                text: `Sprawdź ten artykuł z Sekstar News: ${article.title}`,
                url: `${window.location.origin}${window.location.pathname}#article-${article.id}`
            };
            console.log("DIAGNOSTYKA: Dane do udostępnienia:", shareData);

            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareData.url);
                    alert('Link do artykułu skopiowany do schowka!');
                } else {
                    throw new Error('Share and Clipboard APIs not supported');
                }
            } catch (err) {
                console.error("DIAGNOSTYKA: Błąd podczas udostępniania/kopiowania:", err);
                window.prompt("Skopiuj ten link ręcznie:", shareData.url);
            }
        };
    }
    
    function handleDeepLink() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#article-')) {
            const articleId = hash.substring(9);
            if (state.allArticles.length > 0) {
                displayArticle(articleId);
            } else {
                // Spróbuj ponownie za chwilę, jeśli artykuły się jeszcze nie załadowały
                setTimeout(() => handleDeepLink(), 200);
            }
        }
    }

    // Wklej to w sekcji 7. FUNKCJE POMOCNICZE
// ZASTĄP STARĄ WERSJĘ TĄ NOWĄ:
function parseCommentFormatting(text) {
    // Prosty escape, aby zapobiec wstrzykiwaniu HTML przez użytkownika
    let safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // *Kursywa* -> <i>...</i>
    safeText = safeText.replace(/\*(.*?)\*/g, '<i>$1</i>');

    return safeText;
}

    // Wklej to w sekcji 7. FUNKCJE POMOCNICZE
function wrapTextInFormat(syntax) {
    const textarea = elements.commentSection.messageInput;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = syntax + selectedText + syntax;
    
    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    textarea.selectionEnd = end + syntax.length;
}
    
    // =================================================================
    // === 8. OBSŁUGA ZDARZEŃ ===========================================
    // =================================================================
    
    function handleArticleClick(event) {
        const target = event.target.closest('[data-id]');
        if (target) {
            window.location.hash = `article-${target.dataset.id}`;
            window.scrollTo(0, 0);
        }
    }
    
    function bindEventListeners() {
        elements.backButton.addEventListener('click', () => {
            if (state.commentsListener) state.commentsListener.off();
            showMainView();
        });
        
        elements.slider.container.addEventListener('click', handleArticleClick);
        elements.newsList.addEventListener('click', handleArticleClick);
        
        elements.adminButton.addEventListener('click', () => {
            if (state.isUserAdmin) elements.adminMenu.container.classList.toggle('hidden');
            else showView(elements.views.login);
        });
        
        elements.adminMenu.addButton.addEventListener('click', () => {
            showEditor(null);
            elements.adminMenu.container.classList.add('hidden');
        });
        
        elements.adminMenu.logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                elements.adminMenu.container.classList.add('hidden');
                alert("Wylogowano.");
            });
        });

        elements.loginForm.submitButton.addEventListener('click', handleAdminLogin);
        elements.loginForm.cancelButton.addEventListener('click', () => showView(null));

        elements.commentSection.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = elements.commentSection.nameInput.value.trim();
            const message = elements.commentSection.messageInput.value.trim();
            if (name && message) {
                addComment(name, message);
                elements.commentSection.form.reset();
            }
        });
        
        window.addEventListener('hashchange', handleDeepLink);
        document.getElementById('format-italic-btn').addEventListener('click', () => wrapTextInFormat('*'));
    }

    // =================================================================
    // === 9. INICJALIZACJA APLIKACJI ==================================
    // =================================================================

    function init() {
        state.localUserId = getOrCreateLocalUserId();
        // DIAGNOSTYKA
        console.log("DIAGNOSTYKA: Aplikacja zainicjowana. Wygenerowane ID użytkownika:", state.localUserId);
        
        bindEventListeners();
        initializeAuth();
        loadArticlesFromFirebase();
    }

    init();
});



