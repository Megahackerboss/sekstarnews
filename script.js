/**
 * Główny skrypt aplikacji Sekstar News.
 * Wersja z Systemem Uprawnień (RBAC), Kolorowymi Nickami i Pływającym Edytorem.
 * POPRAWIONA: Zawiera inicjalizację ról i naprawę widoku gościa.
 */
document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // === 1. KONFIGURACJA FIREBASE ====================================
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

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const database = firebase.database();
    const auth = firebase.auth();
    const ARTICLES_PER_PAGE = 5;
    const COMMENTS_PER_PAGE = 5;

    // --- KONFIGURACJA SUPER ADMINA ---
    // Tu wpisz swoje UID (znajdziesz je w Firebase Console -> Authentication)
    // Dzięki temu będziesz miał dostęp do panelu rang nawet jak baza jest pusta.
    const SUPER_ADMIN_UID = 'bNBvAM1hJef0k8YmQ7UlXscYiny2'; 

    // =================================================================
    // === 2. ELEMENTY DOM =============================================
    // =================================================================

    const elements = {
        // Nawigacja
        navTitle: document.querySelector('.nav-title'),
        backButton: document.getElementById('back-button'),
        
        // Widoki
        views: { 
            main: document.getElementById('main-view'), 
            article: document.getElementById('article-view'), 
            editor: document.getElementById('editor-view'),
            userPanel: document.getElementById('user-panel-view') 
        },

        // Slider i Lista
        slider: { container: document.getElementById('featured-slider-container') },
        newsList: document.getElementById('news-list-view'),
        loadMoreArticlesBtn: document.getElementById('load-more-articles-btn'),

        // Szczegóły Artykułu
        articleDetail: { 
            date: document.getElementById('article-date'), 
            author: document.getElementById('article-author'), 
            content: document.getElementById('article-content'), 
            likeButton: document.getElementById('like-button'), 
            likeCount: document.getElementById('like-count'), 
            shareButton: document.getElementById('share-button') 
        },
        
        // Komentarze
        commentSection: { 
            form: document.getElementById('comment-form'), 
            nameInput: document.getElementById('comment-name'), 
            messageInput: document.getElementById('comment-message'), 
            list: document.getElementById('comments-list'), 
            formatItalicBtn: document.getElementById('format-italic-btn'),
            loadMoreBtn: document.getElementById('load-more-comments-btn')
        },

        // Edytor (FAB i Formularz)
        fabEdit: document.getElementById('fab-edit-article'), // Upewnij się, że masz ten element w HTML!
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
            deleteButton: document.getElementById('editor-delete') 
        },

        // Panel Użytkownika
        userPanel: {
            button: document.getElementById('user-panel-button'),
            view: document.getElementById('user-panel-view'),
            infoView: document.getElementById('user-info-view'),
            authView: document.getElementById('auth-view'),
            nickSpan: document.getElementById('user-info-nick'),
            userRoleBadge: document.getElementById('user-current-role-badge'),
            
            // Zakładki
            showLoginTab: document.getElementById('show-login-tab'),
            showRegisterTab: document.getElementById('show-register-tab'),
            showInfoTab: document.getElementById('show-info-tab'),
            showPermsTab: document.getElementById('show-perms-tab'),
            profileInfoContent: document.getElementById('profile-info-content'),
            profilePermsContent: document.getElementById('profile-perms-content'),

            // Formularze Auth
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            registerNick: document.getElementById('register-nick'),
            registerEmail: document.getElementById('register-email'),
            registerPassword: document.getElementById('register-password'),
            authCancelBtn: document.getElementById('auth-cancel-button'),

            // Formularze Profilu
            profileInfoForm: document.getElementById('profile-info-form'),
            profileNickInput: document.getElementById('profile-nick-input'),
            profileColorInput: document.getElementById('profile-color-input'),
            profileEmailInput: document.getElementById('profile-email-input'),
            resetPasswordBtn: document.getElementById('profile-reset-password-button'),
            logoutBtn: document.getElementById('user-panel-logout'),
            closePanelBtn: document.getElementById('user-panel-cancel'),
            
            // Panel Admina (wewnątrz profilu)
            adminEmailInput: document.getElementById('admin-user-email'),
            adminRoleSelect: document.getElementById('admin-role-select'),
            adminAssignBtn: document.getElementById('admin-assign-role-btn'),
            
            roleEditorName: document.getElementById('role-editor-name'),
            rolePermWrite: document.getElementById('perm-write-articles'),
            rolePermDelete: document.getElementById('perm-delete-comments'),
            rolePermManage: document.getElementById('perm-manage-roles'),
            roleSaveBtn: document.getElementById('admin-save-role-btn')
        },
        
        clearCacheBtn: document.getElementById('clear-cache-btn')
    };

    // =================================================================
    // === 3. STAN APLIKACJI ===========================================
    // =================================================================

    let state = {
        allArticlesMeta: [],
        lastLoadedArticleOrder: null,
        areAllArticlesLoaded: false,
        
        allComments: [],
        activeCommentsRef: null,
        currentArticle: null,
        
        sliderInterval: null,
        currentSlideIndex: 0,
        
        currentUser: null, // Obiekt: { uid, email, nick, role, color }
        localUserId: null, // Dla gości
        
        rolesConfig: {}, // Pobrane z bazy definicje ról
        permissions: {   // Aktualne uprawnienia użytkownika
            can_write_articles: false,
            can_delete_comments: false,
            can_manage_roles: false
        }
    };

    // =================================================================
    // === 4. SYSTEM UPRAWNIEŃ (RBAC) ==================================
    // =================================================================

    // Funkcja tworząca domyślne role, jeśli baza jest pusta (Naprawa problemu "Jajko czy Kura")
    function initializeDefaultRoles() {
        database.ref('roles_config').once('value', snapshot => {
            if (!snapshot.exists()) {
                console.log("Tworzenie domyślnych ról...");
                const defaultRoles = {
                    admin: {
                        can_write_articles: true,
                        can_delete_comments: true,
                        can_manage_roles: true
                    },
                    user: {
                        can_write_articles: false,
                        can_delete_comments: false,
                        can_manage_roles: false
                    }
                };
                database.ref('roles_config').set(defaultRoles);
            }
        });
    }

    /**
     * Pobiera definicje ról z bazy danych.
     */
    function loadRolesConfig() {
        database.ref('roles_config').on('value', (snapshot) => {
            state.rolesConfig = snapshot.val() || {};
            // Jeśli użytkownik jest zalogowany, przelicz uprawnienia po zmianie konfigu
            if (state.currentUser) {
                calculatePermissions();
                updateUIForPermissions();
            }
            populateRoleSelect(); // Aktualizuj listę w panelu admina
        });
    }

    /**
     * Oblicza uprawnienia na podstawie roli użytkownika.
     */
    function calculatePermissions() {
        // Domyślne uprawnienia (brak)
        state.permissions = {
            can_write_articles: false,
            can_delete_comments: false,
            can_manage_roles: false
        };

        if (state.currentUser) {
            // Super Admin Bypass (Dostęp z kodu, niezależnie od bazy)
            if (state.currentUser.uid === SUPER_ADMIN_UID) {
                state.permissions = {
                    can_write_articles: true,
                    can_delete_comments: true,
                    can_manage_roles: true
                };
                return;
            }

            const roleName = state.currentUser.role || 'user';
            const roleDef = state.rolesConfig[roleName];

            if (roleDef) {
                state.permissions = {
                    can_write_articles: !!roleDef.can_write_articles,
                    can_delete_comments: !!roleDef.can_delete_comments,
                    can_manage_roles: !!roleDef.can_manage_roles
                };
            }
        }
    }

    /**
     * Sprawdza konkretne uprawnienie.
     */
    function hasPermission(permName) {
        return state.permissions[permName] === true;
    }

    // =================================================================
    // === 5. LOGIKA UI (Widoki i Elementy) ============================
    // =================================================================
    
    function showView(viewToShow) {
        Object.values(elements.views).forEach(view => {
            if(view) view.classList.add('hidden');
        });
        if (viewToShow) viewToShow.classList.remove('hidden');
        
        // FAB (Ołówek) pokazuje się tylko w widoku artykułu I jeśli ma się uprawnienia
        // Sprawdzamy czy element istnieje, bo w HTML mógł nie zostać dodany
        if (elements.fabEdit) {
            if (viewToShow === elements.views.article && hasPermission('can_write_articles')) {
                elements.fabEdit.classList.remove('hidden');
            } else {
                elements.fabEdit.classList.add('hidden');
            }
        }
    }

    function showMainView() {
        showView(elements.views.main);
        elements.backButton.classList.add('hidden');
        elements.navTitle.style.marginLeft = '0px';
        startSlideInterval();
        state.currentArticle = null;
        if (window.location.hash) window.location.hash = '';
    }

    // Wyświetlanie listy artykułów
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

    // Wyświetlanie pojedynczego artykułu
    async function displayArticle(articleId) {
        let articleMeta = state.allArticlesMeta.find(a => a.id == articleId);
        
        if (!articleMeta) {
            try {
                const snapshot = await database.ref(`articles_meta/${articleId}`).once('value');
                articleMeta = snapshot.val();
                if (!articleMeta) { showMainView(); return; }
                state.allArticlesMeta.push(articleMeta);
            } catch (error) { showMainView(); return; }
        }

        state.currentArticle = articleMeta;
        if (state.activeCommentsRef) state.activeCommentsRef.off();

        // Wypełnij dane
        elements.articleDetail.date.textContent = articleMeta.date;
        elements.articleDetail.author.textContent = `Autor: ${articleMeta.author}`;
        elements.articleDetail.content.innerHTML = '<p>Ładowanie treści...</p>';
        
        showView(elements.views.article);
        elements.backButton.classList.remove('hidden');
        elements.navTitle.style.marginLeft = '0px';
        clearInterval(state.sliderInterval);

        // Cache artykułów
        const cached = JSON.parse(localStorage.getItem(`article_${articleId}`));
        if (cached && cached.lastUpdated >= articleMeta.lastUpdated) {
            elements.articleDetail.content.innerHTML = cached.content;
        } else {
            database.ref(`articles_content/${articleId}`).once('value', (snap) => {
                const val = snap.val();
                if (val) {
                    elements.articleDetail.content.innerHTML = val.content;
                    localStorage.setItem(`article_${articleId}`, JSON.stringify({
                        content: val.content,
                        lastUpdated: articleMeta.lastUpdated
                    }));
                }
            });
        }

        state.allComments = [];
        listenForComments(articleId);
        setupLikes(articleId);
        setupShareButton(articleMeta);
    }

    // Slider
    function setupFeaturedSlider(articles) {
        if (articles.length === 0) { elements.slider.container.style.display = 'none'; return; }
        elements.slider.container.style.display = 'block';
        elements.slider.container.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`;
        const content = elements.slider.container.querySelector('.slider-content');
        const nav = elements.slider.container.querySelector('.slider-nav');
        
        articles.forEach((article, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.dataset.id = article.id;
            slide.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="slide-title">${article.title}</div>`;
            content.appendChild(slide);
            
            const navDot = document.createElement('span');
            navDot.className = 'nav-dot';
            navDot.dataset.index = index;
            nav.appendChild(navDot);
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
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
        state.currentSlideIndex = index;
    }

    function startSlideInterval() {
        clearInterval(state.sliderInterval);
        state.sliderInterval = setInterval(() => showSlide(state.currentSlideIndex + 1), 8000);
    }

    // =================================================================
    // === 6. KOMENTARZE ===============================================
    // =================================================================

    function listenForComments(articleId) {
        if (state.activeCommentsRef) state.activeCommentsRef.off();
        
        const ref = database.ref(`comments/${articleId}`);
        state.activeCommentsRef = ref;
        
        elements.commentSection.loadMoreBtn.classList.add('hidden');

        ref.on('value', (snapshot) => {
            const data = snapshot.val();
            state.allComments = data ? Object.entries(data).map(([key, val]) => ({ ...val, commentId: key })).sort((a,b) => b.timestamp - a.timestamp) : [];
            const initialComments = state.allComments.slice(0, COMMENTS_PER_PAGE);
            renderComments(initialComments);
            
            if (state.allComments.length > COMMENTS_PER_PAGE) {
                elements.commentSection.loadMoreBtn.classList.remove('hidden');
            } else {
                elements.commentSection.loadMoreBtn.classList.add('hidden');
            }
        });
    }

    function renderComments(comments) {
        const list = elements.commentSection.list;
        list.innerHTML = '';
        if (comments.length === 0) {
            list.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
            return;
        }

        comments.forEach(comment => {
            const el = document.createElement('div');
            el.className = 'comment';
            el.dataset.commentId = comment.commentId;
            
            // Logika usuwania/edycji
            let controls = '';
            const isMyComment = comment.userId === (state.currentUser ? state.currentUser.uid : state.localUserId);
            
            if (hasPermission('can_delete_comments') || isMyComment) {
                controls = `<div class="comment-controls">`;
                if (isMyComment) controls += `<button class="edit-comment-btn">Edytuj</button>`;
                controls += `<button class="delete-comment-btn">Usuń</button></div>`;
            }

            // Kolor nicku (domyślnie biały)
            const authorColor = comment.userColor || '#ffffff';

            el.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author" style="color: ${authorColor}">${comment.author || 'Anonim'}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p class="comment-message">${parseCommentFormatting(comment.message || '')}</p>
                ${controls}
            `;
            list.appendChild(el);
        });
    }

    function loadMoreComments() {
        const currentCount = elements.commentSection.list.children.length;
        const nextBatch = state.allComments.slice(0, currentCount + COMMENTS_PER_PAGE);
        renderComments(nextBatch);
        if (nextBatch.length >= state.allComments.length) elements.commentSection.loadMoreBtn.classList.add('hidden');
    }

    async function addComment(authorName, message) {
        const cleanName = authorName.trim();
        const lowerName = cleanName.toLowerCase();
        
        // 1. Sprawdź czy nick jest zajęty
        if (state.currentUser) {
            // Zalogowany:
            // Jeśli próbuje użyć innego nicku niż swój własny
            if (lowerName !== state.currentUser.nick.toLowerCase()) {
                const snap = await database.ref(`takenNicks/${lowerName}`).once('value');
                if (snap.exists() && snap.val() !== state.currentUser.uid) {
                    alert("Ten nick jest zajęty przez innego zarejestrowanego użytkownika.");
                    return;
                }
            }
        } else {
            // Gość:
            const snap = await database.ref(`takenNicks/${lowerName}`).once('value');
            if (snap.exists()) {
                alert("Ten nick jest zarejestrowany. Zaloguj się, jeśli to Ty, lub wybierz inny.");
                return;
            }
        }

        const userId = state.currentUser ? state.currentUser.uid : state.localUserId;
        const userColor = state.currentUser ? (state.currentUser.color || '#ffffff') : '#ffffff';

        database.ref(`comments/${state.currentArticle.id}`).push().set({
            author: cleanName,
            message: message,
            userId: userId,
            userColor: userColor, // Zapisujemy kolor
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // =================================================================
    // === 7. EDYTOR ARTYKUŁÓW (MODAL) =================================
    // =================================================================

    function openEditor(article = null) {
        if (!hasPermission('can_write_articles')) {
            alert("Brak uprawnień.");
            return;
        }

        elements.editorForm.form.reset();
        
        if (article) {
            // Edycja istniejącego
            elements.editorForm.idInput.value = article.id;
            elements.editorForm.orderInput.value = article.order || 99;
            elements.editorForm.dateInput.value = article.date || new Date().toLocaleString();
            elements.editorForm.titleInput.value = article.title || '';
            elements.editorForm.authorInput.value = article.author || (state.currentUser ? state.currentUser.nick : '');
            elements.editorForm.thumbnailInput.value = article.thumbnail || '';
            elements.editorForm.featuredCheckbox.checked = article.featured || false;
            elements.editorForm.deleteButton.classList.remove('hidden');
            
            // Pobierz treść
            database.ref(`articles_content/${article.id}`).once('value', s => {
                elements.editorForm.contentInput.value = s.val() ? s.val().content : '';
            });
        } else {
            // Nowy artykuł
            elements.editorForm.idInput.value = Date.now(); // Auto ID
            elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL');
            elements.editorForm.authorInput.value = state.currentUser ? state.currentUser.nick : 'Admin';
            elements.editorForm.deleteButton.classList.add('hidden');
        }
        
        showView(elements.views.editor);
    }

    function saveArticle(e) {
        e.preventDefault();
        const articleId = elements.editorForm.idInput.value;
        const timestamp = Date.now();
        
        const metaData = {
            id: parseInt(articleId),
            order: parseInt(elements.editorForm.orderInput.value),
            date: elements.editorForm.dateInput.value,
            title: elements.editorForm.titleInput.value,
            author: elements.editorForm.authorInput.value,
            thumbnail: elements.editorForm.thumbnailInput.value,
            featured: elements.editorForm.featuredCheckbox.checked,
            lastUpdated: timestamp
        };
        
        const contentData = {
            content: elements.editorForm.contentInput.value
        };

        const updates = {};
        updates[`/articles_meta/${articleId}`] = metaData;
        updates[`/articles_content/${articleId}`] = contentData;

        database.ref().update(updates)
            .then(() => {
                alert("Artykuł zapisany!");
                // Jeśli edytujemy bieżący, odśwież go
                if (state.currentArticle && state.currentArticle.id == articleId) {
                    state.allArticlesMeta = state.allArticlesMeta.map(a => a.id == articleId ? metaData : a);
                    displayArticle(articleId);
                } else {
                    showMainView();
                }
            })
            .catch(err => alert("Błąd zapisu: " + err.message));
    }

    // =================================================================
    // === 8. ZARZĄDZANIE UŻYTKOWNIKAMI I ROLAMI =======================
    // =================================================================

    function updateUserUI() {
        if (state.currentUser) {
            // === ZALOGOWANY ===
            elements.userPanel.button.textContent = state.currentUser.nick.charAt(0).toUpperCase();
            elements.userPanel.button.style.backgroundColor = state.currentUser.color || '#4a68a5';
            
            elements.userPanel.nickSpan.textContent = state.currentUser.nick;
            elements.userPanel.nickSpan.style.color = state.currentUser.color || '#fff';
            
            // Pokazujemy rangę
            elements.userPanel.userRoleBadge.textContent = (state.currentUser.role || 'user').toUpperCase();
            if (state.currentUser.role === 'admin') elements.userPanel.userRoleBadge.style.color = 'red';
            else elements.userPanel.userRoleBadge.style.color = '#ffdd4b';
            
            elements.userPanel.infoView.classList.remove('hidden');
            elements.userPanel.authView.classList.add('hidden');

            // Wypełnij formularz
            elements.userPanel.profileNickInput.value = state.currentUser.nick;
            elements.userPanel.profileEmailInput.value = state.currentUser.email;
            elements.userPanel.profileColorInput.value = state.currentUser.color || '#ffffff';

            // Komentarze
            elements.commentSection.nameInput.value = state.currentUser.nick;
            elements.commentSection.nameInput.disabled = false; 

        } else {
            // === NIEZALOGOWANY (GOŚĆ) ===
            elements.userPanel.button.textContent = '?';
            elements.userPanel.button.style.backgroundColor = '#4a68a5';
            
            elements.userPanel.infoView.classList.add('hidden');
            elements.userPanel.authView.classList.remove('hidden');
            
            // Domyślny widok logowania
            elements.userPanel.loginForm.classList.remove('hidden');
            elements.userPanel.registerForm.classList.add('hidden');
            elements.userPanel.showLoginTab.classList.add('active');
            elements.userPanel.showRegisterTab.classList.remove('active');

            elements.commentSection.nameInput.value = '';
            elements.commentSection.nameInput.disabled = false;
        }

        updateUIForPermissions();
    }

    function updateUIForPermissions() {
        // Pokaż/ukryj zakładkę uprawnień w panelu
        if (hasPermission('can_manage_roles')) {
            elements.userPanel.showPermsTab.classList.remove('hidden');
        } else {
            elements.userPanel.showPermsTab.classList.add('hidden');
        }

        // Pokaż/ukryj przycisk dodawania artykułu w panelu (jako opcja zapasowa)
        // Oraz pokaż/ukryj FAB w widoku artykułu
        if (elements.fabEdit) {
            if (elements.views.article.classList.contains('hidden') === false && hasPermission('can_write_articles')) {
                elements.fabEdit.classList.remove('hidden');
            } else {
                elements.fabEdit.classList.add('hidden');
            }
        }
    }

    function handleProfileUpdate(e) {
        e.preventDefault();
        const newNick = elements.userPanel.profileNickInput.value.trim();
        const newColor = elements.userPanel.profileColorInput.value;
        const oldNick = state.currentUser.nick;

        if (!newNick) return alert("Nick nie może być pusty");

        const updates = {};
        updates[`users/${state.currentUser.uid}/nick`] = newNick;
        updates[`users/${state.currentUser.uid}/color`] = newColor;

        if (newNick.toLowerCase() !== oldNick.toLowerCase()) {
            updates[`takenNicks/${oldNick.toLowerCase()}`] = null;
            updates[`takenNicks/${newNick.toLowerCase()}`] = state.currentUser.uid;
        }

        database.ref().update(updates)
            .then(() => {
                state.currentUser.nick = newNick;
                state.currentUser.color = newColor;
                updateUserUI();
                alert("Zapisano zmiany!");
            })
            .catch(err => alert("Błąd (może nick zajęty?): " + err.message));
    }

    // --- Admin Panel Functions ---

    function populateRoleSelect() {
        const select = elements.userPanel.adminRoleSelect;
        select.innerHTML = '';
        Object.keys(state.rolesConfig).forEach(roleName => {
            const opt = document.createElement('option');
            opt.value = roleName;
            opt.textContent = roleName;
            select.appendChild(opt);
        });
    }

    function assignRole() {
        if (!hasPermission('can_manage_roles')) return;
        
        const email = elements.userPanel.adminEmailInput.value.trim();
        const newRole = elements.userPanel.adminRoleSelect.value;
        
        if(!email) return alert("Podaj email.");

        // Znajdź UID po emailu (wymaga query, co w Firebase bez indexu na email jest trudne, 
        // ale zrobimy to iterując po users - mało wydajne przy dużej skali, ale ok na start)
        database.ref('users').orderByChild('email').equalTo(email).once('value', snap => {
            if(!snap.exists()) return alert("Nie znaleziono użytkownika.");
            
            const uid = Object.keys(snap.val())[0];
            database.ref(`users/${uid}/role`).set(newRole)
                .then(() => alert(`Nadano rolę ${newRole} dla ${email}`))
                .catch(e => alert(e.message));
        });
    }

    function saveRoleDefinition() {
        if (!hasPermission('can_manage_roles')) return;

        const name = elements.userPanel.roleEditorName.value.trim().toLowerCase();
        if(!name) return alert("Podaj nazwę rangi.");

        const perms = {
            can_write_articles: elements.userPanel.rolePermWrite.checked,
            can_delete_comments: elements.userPanel.rolePermDelete.checked,
            can_manage_roles: elements.userPanel.rolePermManage.checked
        };

        database.ref(`roles_config/${name}`).set(perms)
            .then(() => alert("Ranga zaktualizowana!"))
            .catch(e => alert(e.message));
    }

    // =================================================================
    // === 9. INICJALIZACJA I OBSŁUGA ZDARZEŃ ==========================
    // =================================================================

    function initializeAuth() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userRef = database.ref(`users/${user.uid}`);
                const snap = await userRef.once('value');
                const profile = snap.val() || {};

                state.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    nick: profile.nick || 'Użytkownik',
                    color: profile.color || '#ffffff',
                    role: profile.role || 'user'
                };
            } else {
                state.currentUser = null;
            }
            
            calculatePermissions();
            updateUserUI();
        });
    }

    function loadInitialArticles() {
        // Podstawowa konfiguracja ról
        loadRolesConfig();

        let query = database.ref('articles_meta').orderByChild('order').limitToFirst(ARTICLES_PER_PAGE);
        query.once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                elements.loadMoreArticlesBtn.classList.add('hidden');
                handleDeepLink();
                return;
            }
            const newArticles = Object.values(data);
            state.allArticlesMeta = newArticles.sort((a, b) => (a.order || 999) - (b.order || 999));
            
            if (state.allArticlesMeta.length > 0) {
                state.lastLoadedArticleOrder = state.allArticlesMeta[state.allArticlesMeta.length - 1].order;
            }

            displayNewsList(state.allArticlesMeta);
            const featured = state.allArticlesMeta.filter(a => a.featured);
            setupFeaturedSlider(featured);

            if (newArticles.length < ARTICLES_PER_PAGE) {
                state.areAllArticlesLoaded = true;
                elements.loadMoreArticlesBtn.classList.add('hidden');
            } else {
                elements.loadMoreArticlesBtn.classList.remove('hidden');
            }
            handleDeepLink();
        });
    }
    
    function loadMoreArticles() { 
        if (state.areAllArticlesLoaded) return; 
        elements.loadMoreArticlesBtn.disabled = true; 
        elements.loadMoreArticlesBtn.textContent = 'Ładowanie...'; 
        
        let query = database.ref('articles_meta').orderByChild('order').startAfter(state.lastLoadedArticleOrder).limitToFirst(ARTICLES_PER_PAGE); 
        query.once('value', snapshot => { 
            const data = snapshot.val(); 
            if (!data || Object.keys(data).length === 0) { 
                state.areAllArticlesLoaded = true; 
                elements.loadMoreArticlesBtn.classList.add('hidden'); 
                return; 
            } 
            const newArticles = Object.values(data); 
            newArticles.sort((a, b) => (a.order || 999) - (b.order || 999)); 
            state.allArticlesMeta.push(...newArticles); 
            state.lastLoadedArticleOrder = newArticles[newArticles.length - 1].order; 
            displayNewsList(state.allArticlesMeta); 
            elements.loadMoreArticlesBtn.disabled = false; 
            elements.loadMoreArticlesBtn.textContent = 'Wczytaj więcej'; 
            if (newArticles.length < ARTICLES_PER_PAGE) { 
                state.areAllArticlesLoaded = true; 
                elements.loadMoreArticlesBtn.classList.add('hidden'); 
            } 
        }); 
    }

    // Pomocnicze
    function getOrCreateLocalUserId() { 
        let userId = localStorage.getItem('localUserId'); 
        if (!userId) { 
            userId = `guest_${Math.random().toString(36).substr(2, 9)}`; 
            localStorage.setItem('localUserId', userId); 
        } 
        return userId; 
    }
    
    function parseCommentFormatting(text) { 
        let safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
        safeText = safeText.replace(/\*(.*?)\*/g, '<i>$1</i>'); 
        return safeText; 
    }

    function setupLikes(articleId) { 
        const likesRef = database.ref(`articles/${articleId}/likes`); 
        likesRef.on('value', (snapshot) => {
            elements.articleDetail.likeCount.textContent = snapshot.val() || 0;
            const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true'; 
            if (alreadyLiked) { 
                elements.articleDetail.likeButton.classList.add('liked'); 
                elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♥️'; 
            } else { 
                elements.articleDetail.likeButton.classList.remove('liked'); 
                elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♡'; 
            } 
        }); 
    }

    function setupShareButton(article) {
        elements.articleDetail.shareButton.onclick = async () => {
            const data = { title: article.title, text: article.title, url: `${window.location.origin}${window.location.pathname}#article-${article.id}` };
            try { await navigator.share(data); } catch { navigator.clipboard.writeText(data.url); alert("Link skopiowany!"); }
        };
    }

    function handleDeepLink() { 
        const hash = window.location.hash; 
        if (hash && hash.startsWith('#article-')) { 
            const articleId = hash.substring(9); 
            displayArticle(articleId); 
        } else { 
            showMainView(); 
        } 
    }

    // === Listeners ===

    function bindEventListeners() {
        // FAB - Edycja Artykułu
        if (elements.fabEdit) {
            elements.fabEdit.addEventListener('click', () => {
                openEditor(state.currentArticle);
            });
        }

        // Nawigacja
        document.body.addEventListener('click', (event) => {
            const target = event.target;
            
            if (target.closest('#back-button')) { showMainView(); return; }
            if (target.id === 'load-more-articles-btn') { loadMoreArticles(); return; }
            if (target.id === 'load-more-comments-btn') { loadMoreComments(); return; }
            
            // Kliknięcie w artykuł na liście/sliderze
            const card = target.closest('[data-id]');
            if (card && (target.closest('#news-list-view') || target.closest('#featured-slider-container'))) {
                window.location.hash = `article-${card.dataset.id}`;
                return;
            }

            // User Panel & Tabs
            if (target.closest('#user-panel-button')) { elements.userPanel.view.classList.remove('hidden'); return; }
            if (target.id === 'user-panel-cancel' || target.id === 'auth-cancel-button') { elements.userPanel.view.classList.add('hidden'); return; }
            
            if (target.id === 'show-login-tab') {
                elements.userPanel.loginForm.classList.remove('hidden');
                elements.userPanel.registerForm.classList.add('hidden');
                elements.userPanel.showLoginTab.classList.add('active');
                elements.userPanel.showRegisterTab.classList.remove('active');
            }
            if (target.id === 'show-register-tab') {
                elements.userPanel.loginForm.classList.add('hidden');
                elements.userPanel.registerForm.classList.remove('hidden');
                elements.userPanel.showLoginTab.classList.remove('active');
                elements.userPanel.showRegisterTab.classList.add('active');
            }
            if (target.id === 'show-info-tab') {
                elements.userPanel.profileInfoContent.classList.remove('hidden');
                elements.userPanel.profilePermsContent.classList.add('hidden');
                elements.userPanel.showInfoTab.classList.add('active');
                elements.userPanel.showPermsTab.classList.remove('active');
            }
            if (target.id === 'show-perms-tab') {
                elements.userPanel.profileInfoContent.classList.add('hidden');
                elements.userPanel.profilePermsContent.classList.remove('hidden');
                elements.userPanel.showInfoTab.classList.remove('active');
                elements.userPanel.showPermsTab.classList.add('active');
            }

            // Logout
            if (target.id === 'user-panel-logout') { auth.signOut(); elements.userPanel.view.classList.add('hidden'); return; }

            // Polubienia
            if (target.closest('#like-button')) {
                const liked = localStorage.getItem(`liked_${state.currentArticle.id}`) === 'true';
                const ref = database.ref(`articles/${state.currentArticle.id}/likes`);
                if(liked) { localStorage.removeItem(`liked_${state.currentArticle.id}`); ref.set(firebase.database.ServerValue.increment(-1)); }
                else { localStorage.setItem(`liked_${state.currentArticle.id}`, 'true'); ref.set(firebase.database.ServerValue.increment(1)); }
            }
            
            // Formatowanie tekstu komentarza
            if (target.closest('#format-italic-btn')) {
                elements.commentSection.messageInput.value += '*tekst*';
                elements.commentSection.messageInput.focus();
            }

            // Usuwanie komentarza
            if (target.classList.contains('delete-comment-btn')) {
                const commEl = target.closest('.comment');
                if (confirm("Usunąć?")) database.ref(`comments/${state.currentArticle.id}/${commEl.dataset.commentId}`).remove();
            }

            // Edycja komentarza
            if (target.classList.contains('edit-comment-btn')) {
                const commEl = target.closest('.comment');
                const commentId = commEl.dataset.commentId;
                const commentData = state.allComments.find(c => c.commentId === commentId);
                const msgEl = commEl.querySelector('.comment-message');
                const ctrls = commEl.querySelector('.comment-controls');
                
                const editArea = document.createElement('textarea');
                editArea.className = 'comment-edit-textarea';
                editArea.value = commentData.message;
                const saveBtn = document.createElement('button'); saveBtn.textContent = 'Zapisz';
                const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Anuluj';
                
                msgEl.style.display = 'none'; ctrls.style.display = 'none';
                commEl.append(editArea, saveBtn, cancelBtn);
                
                saveBtn.onclick = () => {
                   if(editArea.value.trim()) database.ref(`comments/${state.currentArticle.id}/${commentId}/message`).set(editArea.value.trim());
                };
                cancelBtn.onclick = () => {
                   msgEl.style.display = ''; ctrls.style.display = ''; editArea.remove(); saveBtn.remove(); cancelBtn.remove();
                };
            }
        });

        // Formularze
        elements.userPanel.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(elements.userPanel.loginEmail.value, elements.userPanel.loginPassword.value)
                .then(() => elements.userPanel.view.classList.add('hidden'))
                .catch(e => alert(e.message));
        });

        elements.userPanel.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nick = elements.userPanel.registerNick.value.trim();
            const email = elements.userPanel.registerEmail.value;
            const pass = elements.userPanel.registerPassword.value;

            // Sprawdź czy nick wolny zanim założysz konto
            database.ref(`takenNicks/${nick.toLowerCase()}`).once('value', snap => {
                if (snap.exists()) return alert("Nick zajęty.");
                
                auth.createUserWithEmailAndPassword(email, pass).then(cred => {
                    const u = cred.user;
                    const updates = {};
                    updates[`users/${u.uid}`] = { nick: nick, email: email, role: 'user', color: '#ffffff' };
                    updates[`takenNicks/${nick.toLowerCase()}`] = u.uid;
                    database.ref().update(updates);
                    elements.userPanel.view.classList.add('hidden');
                }).catch(e => alert(e.message));
            });
        });

        elements.userPanel.profileInfoForm.addEventListener('submit', handleProfileUpdate);
        elements.userPanel.resetPasswordBtn.addEventListener('click', () => {
            if(state.currentUser) auth.sendPasswordResetEmail(state.currentUser.email).then(()=>alert("Wysłano email")).catch(e=>alert(e.message));
        });

        elements.userPanel.adminAssignBtn.addEventListener('click', assignRole);
        elements.userPanel.roleSaveBtn.addEventListener('click', saveRoleDefinition);

        elements.commentSection.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = elements.commentSection.nameInput.value;
            const msg = elements.commentSection.messageInput.value;
            if(name && msg) { addComment(name, msg); elements.commentSection.messageInput.value = ''; }
        });

        elements.editorForm.form.addEventListener('submit', saveArticle);
        elements.editorForm.cancelButton.addEventListener('click', () => {
            if (state.currentArticle) showView(elements.views.article);
            else showMainView();
        });
        elements.editorForm.deleteButton.addEventListener('click', () => {
            if(confirm("Na pewno usunąć?")) {
                const id = elements.editorForm.idInput.value;
                const u = {}; u[`articles_meta/${id}`]=null; u[`articles_content/${id}`]=null;
                database.ref().update(u).then(()=>{ alert("Usunięto"); showMainView(); });
            }
        });
        
        window.addEventListener('hashchange', handleDeepLink);
        elements.clearCacheBtn.addEventListener('click', () => {
            Object.keys(localStorage).forEach(k => { if(k.startsWith('article_')) localStorage.removeItem(k); });
            alert("Wyczyszczono cache.");
        });
    }

    // =================================================================
    // === 10. START ===================================================
    // =================================================================
    
    function init() {
        state.localUserId = getOrCreateLocalUserId();
        bindEventListeners();
        initializeAuth();
        loadInitialArticles();
        initializeDefaultRoles(); // Tworzy role jeśli baza pusta
    }
    
    init();
});

