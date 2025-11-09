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

    // NOWA FUNKCJA DO TWORZENIA LOKALNEGO ID UŻYTKOWNIKA
function getOrCreateLocalUserId() {
    let userId = localStorage.getItem('localUserId');
    if (!userId) {
        // Tworzy losowe ID w formacie "user_123456"
        userId = `user_${Math.floor(Math.random() * 1000000)}`;
        localStorage.setItem('localUserId', userId);
    }
    return userId;
}

    // =================================================================
    // === 2. ELEMENTY DOM =============================================
    // =================================================================
    // Przechowywanie referencji do elementów interfejsu w jednym miejscu.

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
        slider: {
            container: document.getElementById('featured-slider-container'),
            content: null, // zostanie uzupełnione dynamicznie
            nav: null, // zostanie uzupełnione dynamicznie
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
     const shareButton = document.getElementById('share-button'); // POPRAWKA: Dodano brakującą zmienną

    // =================================================================
    // === 3. STAN APLIKACJI ===========================================
    // =================================================================
    // Zmienne przechowujące stan, np. listę artykułów, zalogowanego użytkownika.

    let state = {
        allArticles: [],
        currentArticle: null,
        isUserAdmin: false,
        commentsListener: null,
        sliderInterval: null,
        currentSlideIndex: 0,
        localUserId = null; 
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
    
    /** Pokazuje konkretny slajd. */
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
    
    /** Automatycznie przełącza slajdy. */
    function nextSlide() {
        showSlide(state.currentSlideIndex + 1);
    }
    
    /** Uruchamia interwał przełączania slajdów. */
    function startSlideInterval() {
        clearInterval(state.sliderInterval);
        state.sliderInterval = setInterval(nextSlide, 8000);
    }
    
    /** Resetuje interwał (np. po ręcznej zmianie slajdu). */
    function resetSlideInterval() {
        startSlideInterval();
    }

    /** Wyświetla pełną treść wybranego artykułu. */
    // ZASTĄP STARĄ WERSJĘ displayArticle() TĄ NOWĄ:
function displayArticle(articleId) {
    currentArticle = allArticles.find(a => a.id == articleId);
    if (!currentArticle) {
        console.warn(`Nie znaleziono artykułu o ID: ${articleId}`);
        showMainView(); // Wróć do strony głównej, jeśli artykuł nie istnieje
        return;
    }
    
    if (commentsListener) commentsListener.off();

    const articleDate = document.getElementById('article-date');
    const articleAuthor = document.getElementById('article-author');
    const articleContent = document.getElementById('article-content');
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
    setupShareButton(currentArticle); // Aktywujemy przycisk udostępniania
}
        
        state.currentArticle = article;
        
        // Zatrzymaj nasłuchiwanie komentarzy dla poprzedniego artykułu
        if (state.commentsListener) {
            state.commentsListener.off();
        }

        elements.articleDetail.date.textContent = article.date;
        elements.articleDetail.author.textContent = `Autor: ${article.author}`;
        elements.articleDetail.content.innerHTML = article.content;

        showView(elements.views.article);
        elements.backButton.classList.remove('hidden');
        elements.navTitle.style.marginLeft = '0px';
        clearInterval(state.sliderInterval); // Zatrzymaj slider w tle

        // Włącz obsługę polubień, komentarzy i udostępniania
        setupLikes(article.id);
        listenForComments(article.id);
        setupShareButton(article);
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
            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.author || 'Anonim'}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p class="comment-message">${comment.message || ''}</p>`;
            elements.commentSection.list.appendChild(commentEl);
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
        
        if (article) {
            // Edycja istniejącego
            elements.editorForm.idInput.value = article.id;
            elements.editorForm.orderInput.value = article.order || 99;
            elements.editorForm.dateInput.value = article.date || new Date().toLocaleString();
            elements.editorForm.titleInput.value = article.title || '';
            elements.editorForm.authorInput.value = article.author || '';
            elements.editorForm.thumbnailInput.value = article.thumbnail || '';
            elements.editorForm.featuredCheckbox.checked = article.featured || false;
            elements.editorForm.contentInput.value = article.content || '';
            elements.editorForm.deleteButton.classList.remove('hidden');
        } else {
            // Tworzenie nowego
            elements.editorForm.form.reset();
            elements.editorForm.idInput.value = Date.now();
            elements.editorForm.dateInput.value = new Date().toLocaleString();
            elements.editorForm.deleteButton.classList.add('hidden');
        }
        showView(elements.views.editor);
    }
    
    /** Pokazuje główny widok aplikacji. */
    function showMainView() {
        showView(elements.views.main);
        elements.backButton.classList.add('hidden');
        if (elements.backButton.offsetWidth > 0) {
           elements.navTitle.style.marginLeft = `-${elements.backButton.offsetWidth}px`;
        }
        startSlideInterval();
        state.currentArticle = null;
    }

    // =================================================================
    // === 5. INTERAKCJE Z FIREBASE =====================================
    // =================================================================
    
    /** Pobiera i nasłuchuje zmian w artykułach. */
    function loadArticlesFromFirebase() {
        const contentRef = database.ref('content');
        contentRef.on('value', (snapshot) => {
            const data = snapshot.val();
            state.allArticles = data ? Object.values(data) : [];
            state.allArticles.sort((a, b) => (a.order || 999) - (b.order || 999));
            
            const featuredArticles = state.allArticles.filter(a => a.featured).slice(0, 5);
            
            displayNewsList(state.allArticles);
            setupFeaturedSlider(featuredArticles);
        });
    }

    /** Zapisuje artykuł do bazy danych. */
    function saveArticle(articleData) {
        database.ref(`content/${articleData.id}`).set(articleData)
            .then(() => {
                alert("Artykuł zapisany!");
                showView(null); // ukryj edytor
            })
            .catch(err => {
                console.error(err);
                alert("Błąd zapisu! Upewnij się, że jesteś zalogowany i masz uprawnienia.");
            });
    }
    
    /** Usuwa artykuł z bazy danych. */
    function deleteArticle(articleId) {
        if (confirm(`Czy na pewno chcesz usunąć artykuł ID: ${articleId}?`)) {
            database.ref(`content/${articleId}`).remove()
                .then(() => {
                    alert("Artykuł usunięty.");
                    showView(null);
                })
                .catch(err => {
                    console.error(err);
                    alert("Błąd usuwania!");
                });
        }
    }
    
    /** Pobiera i nasłuchuje zmian liczby polubień. */
    function setupLikes(articleId) {
        const likesRef = database.ref(`articles/${articleId}/likes`);
        likesRef.on('value', (snapshot) => {
            const likes = snapshot.val() || 0;
            updateLikeButton(likes, articleId);
        });
        
        // Jednorazowe przypisanie funkcji kliknięcia
        elements.articleDetail.likeButton.onclick = () => handleLikeClick(articleId);
    }
    
    /** Obsługuje kliknięcie przycisku polubienia. */
    function handleLikeClick(articleId) {
        const currentLikesRef = database.ref(`articles/${articleId}/likes`);
        const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true';

        if (alreadyLiked) {
            localStorage.removeItem(`liked_${articleId}`);
            currentLikesRef.set(firebase.database.ServerValue.increment(-1));
        } else {
            localStorage.setItem(`liked_${articleId}`, 'true');
            currentLikesRef.set(firebase.database.ServerValue.increment(1));
        }
    }

    /** Nasłuchuje nowych komentarzy dla danego artykułu. */
    function listenForComments(articleId) {
    const commentsList = document.getElementById('comments-list');
    commentsListener = database.ref(`comments/${articleId}`).orderByChild('timestamp');
    commentsListener.on('value', (snapshot) => {
        const commentsData = snapshot.val();
        const comments = commentsData ? Object.entries(commentsData).map(([key, value]) => ({ commentId: key, ...value })) : [];
        loadComments(comments.reverse(), commentsList);
    });
}

    /** Dodaje nowy komentarz do bazy danych. */
    function addComment(author, message) {
    const commentsRef = database.ref(`comments/${currentArticle.id}`);
    const newCommentRef = commentsRef.push();
    newCommentRef.set({
        author: author,
        message: message,
        userId: localUserId, // Zapisujemy ID użytkownika
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}



function loadComments(comments, commentsList) {
    commentsList.innerHTML = '';
    if (comments.length === 0) {
        commentsList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
    } else {
        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            
            let controls = '';
            if (loggedIn || comment.userId === localUserId) {
                controls = `
                    <div class="comment-controls">
                        <button class="edit-comment-btn" data-comment-id="${comment.commentId}">Edytuj</button>
                        <button class="delete-comment-btn" data-comment-id="${comment.commentId}">Usuń</button>
                    </div>
                `;
            }

            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.author || 'Anonim'}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p class="comment-message">${comment.message || ''}</p>
                ${controls}
            `;
            commentsList.appendChild(commentEl);
        });

        document.querySelectorAll('.edit-comment-btn').forEach(btn => {
            btn.onclick = () => {
                const commentToEdit = comments.find(c => c.commentId === btn.dataset.commentId);
                showCommentEditor(commentToEdit);
            };
        });

        document.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.onclick = () => {
                if (confirm("Czy na pewno chcesz usunąć ten komentarz?")) {
                    database.ref(`comments/${currentArticle.id}/${btn.dataset.commentId}`).remove();
                }
            };
        });
    }
}



// NOWA FUNKCJA DO OBSŁUGI EDYTORA KOMENTARZY
function showCommentEditor(comment) {
    const commentEditorView = document.getElementById('comment-editor-view');
    const commentEditorTextarea = document.getElementById('comment-editor-textarea');
    const commentEditorSaveBtn = document.getElementById('comment-editor-save');
    const commentEditorCancelBtn = document.getElementById('comment-editor-cancel');

    commentEditorTextarea.value = comment.message;
    commentEditorView.classList.remove('hidden');

    commentEditorSaveBtn.onclick = () => {
        const newText = commentEditorTextarea.value;
        if (newText) {
            database.ref(`comments/${currentArticle.id}/${comment.commentId}/message`).set(newText);
            commentEditorView.classList.add('hidden');
        }
    };
    commentEditorCancelBtn.onclick = () => commentEditorView.classList.add('hidden');
}
    
    // =================================================================
    // === 6. LOGIKA UWIERZYTELNIANIA ==================================
    // =================================================================

    /** Inicjalizuje proces uwierzytelniania i nasłuchuje zmian stanu zalogowania. */
    function initializeAuth() {
        auth.onAuthStateChanged(user => {
            if (user && !user.isAnonymous) {
                // Użytkownik zalogowany jako administrator
                state.isUserAdmin = true;
                elements.adminButton.textContent = "≡"; // Ikona menu
            } else {
                // Użytkownik anonimowy lub wylogowany
                state.isUserAdmin = false;
                elements.adminButton.textContent = "?"; // Ikona logowania
                
                // Jeśli nikt nie jest zalogowany (nawet anonimowo), zaloguj go anonimowo
                if (!user) {
                    auth.signInAnonymously().catch(error => {
                        console.error("Błąd logowania anonimowego:", error);
                    });
                }
            }
        });
    }
    
    /** Obsługuje próbę zalogowania administratora. */
    function handleAdminLogin() {
        const email = elements.loginForm.emailInput.value;
        const pass = elements.loginForm.passwordInput.value;
        
        auth.signInWithEmailAndPassword(email, pass)
            .then(() => {
                elements.views.login.classList.add('hidden');
            })
            .catch(error => {
                alert(`Błąd logowania: ${error.message}`);
            });
    }

    // =================================================================
    // === 7. FUNKCJE POMOCNICZE (np. Udostępnianie, Deep Link) ========
    // =================================================================
    
    /** Konfiguruje przycisk udostępniania dla danego artykułu. */
    // ZNAJDŹ I ZASTĄP TĘ FUNKCJĘ
function setupShareButton(article) {
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
    
    /** Sprawdza, czy URL zawiera "deep link" do konkretnego artykułu i go wyświetla. */
    function handleDeepLink() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#article-')) {
            const articleId = hash.substring(9);
            // Opóźnienie, aby dać czas na załadowanie artykułów z Firebase
            setTimeout(() => {
                if (articleId && state.allArticles.some(a => a.id == articleId)) {
                    displayArticle(articleId);
                }
            }, 500);
        }
    }
    
    // =================================================================
    // === 8. OBSŁUGA ZDARZEŃ (EVENT LISTENERS) ========================
    // =================================================================
    
    /** Obsługuje kliknięcie na kartę artykułu lub slajd. */
    function handleArticleClick(event) {
        const targetElement = event.target.closest('[data-id]');
        if (!targetElement) return;

        const articleId = targetElement.dataset.id;
        if (state.isUserAdmin) {
            const articleToEdit = state.allArticles.find(a => a.id == articleId);
            showEditor(articleToEdit);
        } else {
            displayArticle(articleId);
        }
        window.scrollTo(0, 0); // Przewiń na górę strony
    }
    
    /** Obsługuje wysłanie formularza edytora. */
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
    
    /** Dodaje wszystkie niezbędne nasłuchiwacze zdarzeń do elementów DOM. */
    function bindEventListeners() {
        // Nawigacja
        elements.backButton.addEventListener('click', () => {
            if (state.commentsListener) state.commentsListener.off();
            showMainView();
        });
        
        // Kliknięcie artykułu
        elements.slider.container.addEventListener('click', handleArticleClick);
        elements.newsList.addEventListener('click', handleArticleClick);

        // Menu admina
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

        // Formularz logowania
        elements.loginForm.submitButton.addEventListener('click', handleAdminLogin);
        elements.loginForm.cancelButton.addEventListener('click', () => elements.views.login.classList.add('hidden'));

        // Formularz edytora
        elements.editorForm.form.addEventListener('submit', handleEditorSubmit);
        elements.editorForm.cancelButton.addEventListener('click', () => showView(null));
        elements.editorForm.deleteButton.addEventListener('click', () => {
            const articleId = elements.editorForm.idInput.value;
            deleteArticle(articleId);
        });
        
        // Formularz komentarzy
        elements.commentSection.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = elements.commentSection.nameInput.value.trim();
            const message = elements.commentSection.messageInput.value.trim();
            if (name && message) {
                addComment(name, message);
                elements.commentSection.form.reset();
            }
        });
        
        // Slider
        elements.slider.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-dot')) {
                const index = parseInt(e.target.dataset.index, 10);
                showSlide(index);
                resetSlideInterval();
            }
        });
    }


    // =================================================================
    // === 9.2. SHAREBUTTON           ==================================
    // =================================================================


// NOWA FUNKCJA DO OBSŁUGI LINKÓW
function handleDeepLink() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#article-')) {
        const articleId = hash.substring(9);
        if (allArticles.length > 0 && allArticles.some(a => a.id == articleId)) {
            displayArticle(articleId);
        } else if (allArticles.length === 0) {
            // Jeśli artykuły się jeszcze nie załadowały, poczekaj i spróbuj ponownie
            setTimeout(handleDeepLink, 100);
        }
    } else {
        // Jeśli nie ma hasha w linku, pokaż stronę główną
        showMainView();
    }
}

// NOWA, SPRAWDZONA FUNKCJA UDOSTĘPNIANIA
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
    // =================================================================
    // === 9. INICJALIZACJA APLIKACJI ==================================
    // =================================================================

    /** Główna funkcja inicjalizująca aplikację. */
    function init() {
    // Uruchamiamy tworzenie ID na samym początku
    localUserId = getOrCreateLocalUserId();

    backButton.addEventListener('click', () => {
        if (commentsListener) commentsListener.off();
        showMainView();
    });

    function handleArticleClick(event) {
        const targetElement = event.target.closest('[data-id]');
        if (targetElement) {
            if (loggedIn) {
                const articleToEdit = allArticles.find(a => a.id == targetElement.dataset.id);
                showEditor(articleToEdit);
            } else {
                // Zamiast od razu wyświetlać, zmieniamy hash w URL
                window.location.hash = `article-${targetElement.dataset.id}`;
            }
            window.scrollTo(0, 0);
        }
    }
    featuredSliderContainer.addEventListener('click', handleArticleClick);
    newsListView.addEventListener('click', handleArticleClick);
    
    // Nasłuchuj zmiany hasha w URL (gdy ktoś kliknie link lub przycisk wstecz)
    window.addEventListener('hashchange', handleDeepLink);

    // Załaduj artykuły z Firebase (to automatycznie uruchomi też handleDeepLink)
    loadArticlesFromFirebase();
}

    init(); // Uruchomienie aplikacji!
});



