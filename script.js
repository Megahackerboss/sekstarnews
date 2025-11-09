/**
 * Główny skrypt aplikacji Sekstar News.
 * Zarządza interakcją z Firebase, renderowaniem widoków,
 * obsługą zdarzeń oraz logiką uwierzytelniania.
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
        slider: {
            container: document.getElementById('featured-slider-container'),
            content: null,
            nav: null,
        },
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
        }
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
        localUserId: null, // POPRAWKA: Poprawna składnia (przecinek zamiast średnika)
    };

    // =================================================================
    // === 4. LOGIKA UI (INTERFEJSU UŻYTKOWNIKA) ========================
    // =================================================================

    /** Pokazuje wybrany widok, ukrywając pozostałe. */
    function showView(viewToShow) {
        Object.values(elements.views).forEach(view => view.classList.add('hidden'));
        if (viewToShow) {
            viewToShow.classList.remove('hidden');
        }
    }
    
    /** Pokazuje główny widok aplikacji. */
    function showMainView() {
        showView(elements.views.main);
        elements.backButton.classList.add('hidden');
        elements.navTitle.style.marginLeft = '50%'; // Reset do pierwotnej pozycji
        startSlideInterval();
        state.currentArticle = null;
        window.location.hash = ''; // Czyści hash z URL
    }
    
    /** Wyświetla listę wszystkich artykułów na stronie głównej. */
    function displayNewsList(articles) {
        elements.newsList.innerHTML = '';
        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'article-card';
            card.dataset.id = article.id;
            card.innerHTML = `
                <img src="${article.thumbnail}" alt="${article.title}">
                <div class="article-card-content">
                    <h4>${article.title}</h4>
                </div>`;
            elements.newsList.appendChild(card);
        });
    }

    /** Konfiguruje i wyświetla slider z polecanymi artykułami. */
    function setupFeaturedSlider(articles) {
        if (articles.length === 0) {
            elements.slider.container.style.display = 'none';
            return;
        }
        elements.slider.container.style.display = 'block';
        elements.slider.container.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`;
        elements.slider.content = elements.slider.container.querySelector('.slider-content');
        elements.slider.nav = elements.slider.container.querySelector('.slider-nav');

        articles.forEach((article, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.dataset.id = article.id;
            slide.innerHTML = `
                <img src="${article.thumbnail}" alt="${article.title}">
                <div class="slide-title">${article.title}</div>`;
            elements.slider.content.appendChild(slide);

            const navDot = document.createElement('span');
            navDot.className = 'nav-dot';
            navDot.dataset.index = index;
            elements.slider.nav.appendChild(navDot);
        });

        showSlide(0);
        startSlideInterval();
    }
    
    function showSlide(index) {
        const slides = elements.slider.container.querySelectorAll('.slide');
        const dots = elements.slider.container.querySelectorAll('.nav-dot');
        if (!slides.length) return;

        if (index >= slides.length) index = 0;
        if (index < 0) index = slides.length - 1;

        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        if (slides[index]) slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
        
        state.currentSlideIndex = index;
    }
    
    function nextSlide() {
        showSlide(state.currentSlideIndex + 1);
    }
    
    function startSlideInterval() {
        clearInterval(state.sliderInterval);
        state.sliderInterval = setInterval(nextSlide, 8000);
    }
    
    function resetSlideInterval() {
        startSlideInterval();
    }

    /** Wyświetla pełną treść wybranego artykułu. */
    function displayArticle(articleId) {
        const article = state.allArticles.find(a => a.id == articleId);
        if (!article) {
            console.warn(`Nie znaleziono artykułu o ID: ${articleId}`);
            showMainView();
            return;
        }
        
        state.currentArticle = article;
        
        if (state.commentsListener) {
            state.commentsListener.off();
        }

        elements.articleDetail.date.textContent = article.date;
        elements.articleDetail.author.textContent = `Autor: ${article.author}`;
        elements.articleDetail.content.innerHTML = article.content;

        showView(elements.views.article);
        elements.backButton.classList.remove('hidden');
        elements.navTitle.style.marginLeft = '0px';
        clearInterval(state.sliderInterval);

        setupLikes(article.id);
        listenForComments(article.id);
        setupShareButton(article); // POPRAWKA: Wywołanie poprawionej funkcji
    }
    
    /** Wyświetla pobrane komentarze pod artykułem. */
    function renderComments(comments) {
        elements.commentSection.list.innerHTML = '';
        if (comments.length === 0) {
            elements.commentSection.list.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
            return;
        }

        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            
            // POPRAWKA: Logika sprawdzająca, czy pokazać przyciski
            let controls = '';
            if (state.isUserAdmin || comment.userId === state.localUserId) {
                controls = `
                    <div class="comment-controls">
                        <button class="edit-comment-btn" data-comment-id="${comment.commentId}">Edytuj</button>
                        <button class="delete-comment-btn" data-comment-id="${comment.commentId}">Usuń</button>
                    </div>`;
            }

            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.author || 'Anonim'}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p class="comment-message">${comment.message || ''}</p>
                ${controls}`;
            elements.commentSection.list.appendChild(commentEl);
        });

        // Przypisanie eventów do nowo utworzonych przycisków
        document.querySelectorAll('.edit-comment-btn').forEach(btn => {
            btn.onclick = () => {
                const commentToEdit = comments.find(c => c.commentId === btn.dataset.commentId);
                showCommentEditor(commentToEdit);
            };
        });

        document.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.onclick = () => {
                if (confirm("Czy na pewno chcesz usunąć ten komentarz?")) {
                    database.ref(`comments/${state.currentArticle.id}/${btn.dataset.commentId}`).remove();
                }
            };
        });
    }

    /** Aktualizuje wygląd przycisku "polubienia". */
    function updateLikeButton(likesCount, articleId) {
        elements.articleDetail.likeCount.textContent = likesCount;
        const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true';

        if (alreadyLiked) {
            elements.articleDetail.likeButton.classList.add('liked');
            elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♥️';
        } else {
            elements.articleDetail.likeButton.classList.remove('liked');
            elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♡';
        }
        elements.articleDetail.likeButton.disabled = false;
    }
    
    /** Pokazuje widok edytora (tworzenie nowego lub edycja istniejącego artykułu). */
    function showEditor(article = null) {
        if (!state.isUserAdmin) return;
        
        elements.editorForm.form.reset(); // Zawsze resetuj formularz na początku

        if (article) { // Edycja
            elements.editorForm.idInput.value = article.id;
            elements.editorForm.orderInput.value = article.order || 99;
            elements.editorForm.dateInput.value = article.date || new Date().toLocaleString();
            elements.editorForm.titleInput.value = article.title || '';
            elements.editorForm.authorInput.value = article.author || '';
            elements.editorForm.thumbnailInput.value = article.thumbnail || '';
            elements.editorForm.featuredCheckbox.checked = article.featured || false;
            elements.editorForm.contentInput.value = article.content || '';
            elements.editorForm.deleteButton.classList.remove('hidden');
        } else { // Tworzenie nowego
            elements.editorForm.idInput.value = Date.now();
            elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL');
            elements.editorForm.deleteButton.classList.add('hidden');
        }
        showView(elements.views.editor);
    }
    
    /** Pokazuje edytor komentarza. */
    function showCommentEditor(comment) {
        elements.commentEditor.textarea.value = comment.message;
        showView(elements.views.commentEditor);

        elements.commentEditor.saveButton.onclick = () => {
            const newText = elements.commentEditor.textarea.value.trim();
            if (newText) {
                database.ref(`comments/${state.currentArticle.id}/${comment.commentId}/message`).set(newText);
                showView(elements.views.article); // Wróć do artykułu
            }
        };
        elements.commentEditor.cancelButton.onclick = () => showView(elements.views.article);
    }

    // =================================================================
    // === 5. INTERAKCJE Z FIREBASE =====================================
    // =================================================================
    
    function loadArticlesFromFirebase() {
        database.ref('content').on('value', (snapshot) => {
            const data = snapshot.val();
            state.allArticles = data ? Object.values(data) : [];
            state.allArticles.sort((a, b) => (a.order || 999) - (b.order || 999));
            
            const featuredArticles = state.allArticles.filter(a => a.featured).slice(0, 5);
            
            displayNewsList(state.allArticles);
            setupFeaturedSlider(featuredArticles);

            // Po załadowaniu artykułów sprawdź, czy nie ma deep linku
            handleDeepLink();
        });
    }

    function saveArticle(articleData) {
        database.ref(`content/${articleData.id}`).set(articleData)
            .then(() => {
                alert("Artykuł zapisany!");
                showMainView();
            })
            .catch(err => console.error(err) || alert("Błąd zapisu!"));
    }
    
    function deleteArticle(articleId) {
        if (confirm(`Czy na pewno chcesz usunąć artykuł ID: ${articleId}?`)) {
            database.ref(`content/${articleId}`).remove()
                .then(() => {
                    alert("Artykuł usunięty.");
                    showMainView();
                })
                .catch(err => console.error(err) || alert("Błąd usuwania!"));
        }
    }
    
    function setupLikes(articleId) {
        const likesRef = database.ref(`articles/${articleId}/likes`);
        likesRef.on('value', (snapshot) => {
            updateLikeButton(snapshot.val() || 0, articleId);
        });
        
        elements.articleDetail.likeButton.onclick = () => handleLikeClick(articleId);
    }
    
    function handleLikeClick(articleId) {
        const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true';
        const likesRef = database.ref(`articles/${articleId}/likes`);
        
        if (alreadyLiked) {
            localStorage.removeItem(`liked_${articleId}`);
            likesRef.set(firebase.database.ServerValue.increment(-1));
        } else {
            localStorage.setItem(`liked_${articleId}`, 'true');
            likesRef.set(firebase.database.ServerValue.increment(1));
        }
    }

    function listenForComments(articleId) {
        state.commentsListener = database.ref(`comments/${articleId}`).orderByChild('timestamp');
        state.commentsListener.on('value', (snapshot) => {
            const data = snapshot.val();
            const comments = data ? Object.entries(data).map(([key, val]) => ({ ...val, commentId: key })) : [];
            renderComments(comments.reverse());
        });
    }

    function addComment(author, message) {
        if (!state.currentArticle || !state.localUserId) {
            console.error("Błąd: Brak ID artykułu lub użytkownika do dodania komentarza.");
            return;
        }
        // POPRAWKA: Zapisywanie komentarza z poprawnym `userId`
        database.ref(`comments/${state.currentArticle.id}`).push().set({
            author: author,
            message: message,
            userId: state.localUserId,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // =================================================================
    // === 6. LOGIKA UWIERZYTELNIANIA ==================================
    // =================================================================

    function initializeAuth() {
        auth.onAuthStateChanged(user => {
            state.isUserAdmin = user && !user.isAnonymous;
            elements.adminButton.textContent = state.isUserAdmin ? "≡" : "?";
            if (!user) {
                auth.signInAnonymously().catch(err => console.error("Błąd logowania anonimowego:", err));
            }
        });
    }
    
    function handleAdminLogin() {
        const email = elements.loginForm.emailInput.value;
        const pass = elements.loginForm.passwordInput.value;
        auth.signInWithEmailAndPassword(email, pass)
            .then(() => showView(null))
            .catch(err => alert(`Błąd logowania: ${err.message}`));
    }

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
    
    // POPRAWKA: Jedna, poprawna wersja funkcji udostępniania
    function setupShareButton(article) {
        elements.articleDetail.shareButton.onclick = async () => {
            const shareData = {
                title: article.title,
                text: `Sprawdź ten artykuł z Sekstar News: ${article.title}`,
                url: `${window.location.origin}${window.location.pathname}#article-${article.id}`
            };

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
                console.warn("Udostępnianie/kopiowanie nie powiodło się:", err);
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
            }
        }
    }
    
    // =================================================================
    // === 8. OBSŁUGA ZDARZEŃ (EVENT LISTENERS) ========================
    // =================================================================
    
    function handleArticleClick(event) {
        const target = event.target.closest('[data-id]');
        if (!target) return;

        const articleId = target.dataset.id;
        window.location.hash = `article-${articleId}`;
        window.scrollTo(0, 0);
    }
    
    function handleEditorSubmit(e) {
        e.preventDefault();
        const articleData = {
            id: parseInt(elements.editorForm.idInput.value),
            order: parseInt(elements.editorForm.orderInput.value),
            date: elements.editorForm.dateInput.value,
            title: elements.editorForm.titleInput.value,
            author: elements.editorForm.authorInput.value,
            thumbnail: elements.editorForm.thumbnailInput.value,
            featured: elements.editorForm.featuredCheckbox.checked,
            content: elements.editorForm.contentInput.value,
        };
        saveArticle(articleData);
    }
    
    function bindEventListeners() {
        elements.backButton.addEventListener('click', () => {
            if (state.commentsListener) state.commentsListener.off();
            showMainView();
        });
        
        elements.slider.container.addEventListener('click', handleArticleClick);
        elements.newsList.addEventListener('click', handleArticleClick);

        elements.adminButton.addEventListener('click', () => {
            if (state.isUserAdmin) {
                elements.adminMenu.container.classList.toggle('hidden');
            } else {
                showView(elements.views.login);
            }
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

        elements.editorForm.form.addEventListener('submit', handleEditorSubmit);
        elements.editorForm.cancelButton.addEventListener('click', () => showMainView());
        elements.editorForm.deleteButton.addEventListener('click', () => {
            deleteArticle(elements.editorForm.idInput.value);
        });
        
        elements.commentSection.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = elements.commentSection.nameInput.value.trim();
            const message = elements.commentSection.messageInput.value.trim();
            if (name && message) {
                addComment(name, message);
                elements.commentSection.form.reset();
            }
        });
        
        elements.slider.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-dot')) {
                showSlide(parseInt(e.target.dataset.index, 10));
                resetSlideInterval();
            }
        });

        window.addEventListener('hashchange', handleDeepLink);
    }

    // =================================================================
    // === 9. INICJALIZACJA APLIKACJI ==================================
    // =================================================================

    function init() {
        state.localUserId = getOrCreateLocalUserId(); // Inicjalizujemy ID użytkownika na starcie
        bindEventListeners();
        initializeAuth();
        loadArticlesFromFirebase();
    }

    init();
});
