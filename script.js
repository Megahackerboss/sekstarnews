document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // === 1. KONFIGURACJA =============================================
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

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const auth = firebase.auth();
    const ARTICLES_PER_PAGE = 5;
    const COMMENTS_PER_PAGE = 5;

    // =================================================================
    // === 2. ELEMENTY DOM =============================================
    // =================================================================
    const elements = {
        views: { 
            main: document.getElementById('main-view'), 
            article: document.getElementById('article-view'), 
            editor: document.getElementById('editor-view'),
            userPanel: document.getElementById('user-panel-view') 
        },
        backButton: document.getElementById('back-button'),
        newsList: document.getElementById('news-list-view'),
        loadMoreArticlesBtn: document.getElementById('load-more-articles-btn'),
        slider: { container: document.getElementById('featured-slider-container') },
        
        articleDetail: { 
            date: document.getElementById('article-date'), 
            author: document.getElementById('article-author'), 
            content: document.getElementById('article-content'), 
            likeButton: document.getElementById('like-button'), 
            likeCount: document.getElementById('like-count'), 
            shareButton: document.getElementById('share-button') 
        },
        
        commentSection: { 
            form: document.getElementById('comment-form'), 
            nameInput: document.getElementById('comment-name'), 
            messageInput: document.getElementById('comment-message'), 
            list: document.getElementById('comments-list'), 
            formatItalicBtn: document.getElementById('format-italic-btn'),
            loadMoreBtn: document.getElementById('load-more-comments-btn')
        },

        fabEdit: document.getElementById('fab-edit-article'),
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

        userPanel: {
            button: document.getElementById('user-panel-button'),
            view: document.getElementById('user-panel-view'),
            infoView: document.getElementById('user-info-view'),
            authView: document.getElementById('auth-view'),
            
            nickSpan: document.getElementById('user-info-nick'),
            userRoleBadge: document.getElementById('user-current-role-badge'),
            profileNickInput: document.getElementById('profile-nick-input'),
            profileColorInput: document.getElementById('profile-color-input'),
            profileEmailInput: document.getElementById('profile-email-input'),
            profileInfoForm: document.getElementById('profile-info-form'),
            
            tabs: {
                infoBtn: document.getElementById('show-info-tab'),
                permsBtn: document.getElementById('show-perms-tab'),
                loginBtn: document.getElementById('show-login-tab'),
                registerBtn: document.getElementById('show-register-tab')
            },
            contents: {
                info: document.getElementById('profile-info-content'),
                perms: document.getElementById('profile-perms-content'),
                login: document.getElementById('login-form'),
                register: document.getElementById('register-form')
            },

            // Admin Panel
            adminNickInput: document.getElementById('admin-user-email'), 
            adminRoleSelect: document.getElementById('admin-role-select'),
            adminAssignBtn: document.getElementById('admin-assign-role-btn'),
            roleEditorName: document.getElementById('role-editor-name'),
            rolePermWrite: document.getElementById('perm-write-articles'),
            rolePermDelete: document.getElementById('perm-delete-comments'),
            rolePermManage: document.getElementById('perm-manage-roles'),
            roleSaveBtn: document.getElementById('admin-save-role-btn'),
            
            // Auth inputs
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            registerNick: document.getElementById('register-nick'),
            registerEmail: document.getElementById('register-email'),
            registerPassword: document.getElementById('register-password'),
            
            logoutBtn: document.getElementById('user-panel-logout'),
            closePanelBtn: document.getElementById('user-panel-cancel'),
            authCancelBtn: document.getElementById('auth-cancel-button'),
            
            addNewArticleBtn: document.createElement('button') 
        },
        clearCacheBtn: document.getElementById('clear-cache-btn')
    };

    elements.userPanel.addNewArticleBtn.textContent = "+ Utwórz Nowy Artykuł";
    elements.userPanel.addNewArticleBtn.style.backgroundColor = "#28a745";
    elements.userPanel.addNewArticleBtn.style.marginTop = "10px";
    elements.userPanel.addNewArticleBtn.className = "hidden";
    document.querySelector('#profile-perms-content').prepend(elements.userPanel.addNewArticleBtn);

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
        currentUser: null,
        localUserId: localStorage.getItem('localUserId') || `guest_${Math.random().toString(36).substr(2, 9)}`,
        rolesConfig: {},
        permissions: { can_write_articles: false, can_delete_comments: false, can_manage_roles: false },
        sliderInterval: null,
        currentSlideIndex: 0
    };
    if(!localStorage.getItem('localUserId')) localStorage.setItem('localUserId', state.localUserId);

    // =================================================================
    // === 4. LOGIKA UPRAWNIEŃ I DANYCH ================================
    // =================================================================
    function loadRolesConfig() {
        database.ref('roles_config').on('value', snap => {
            state.rolesConfig = snap.val() || {};
            if(state.currentUser) calculatePermissions();
            populateRoleSelect();
        });
    }

    function calculatePermissions() {
        state.permissions = { can_write_articles: false, can_delete_comments: false, can_manage_roles: false };
        if (state.currentUser) {
            const roleName = state.currentUser.role || 'user';
            const roleDef = state.rolesConfig[roleName];
            if (roleDef) state.permissions = roleDef;
        }
        updateUIForPermissions();
    }

    function hasPermission(perm) { return state.permissions[perm] === true; }

    function updateUIForPermissions() {
        const permsTab = elements.userPanel.tabs.permsBtn;
        if (permsTab) permsTab.classList.toggle('hidden', !hasPermission('can_manage_roles'));
        elements.userPanel.addNewArticleBtn.classList.toggle('hidden', !hasPermission('can_write_articles'));
        if (elements.fabEdit) {
            const isArticleView = !elements.views.article.classList.contains('hidden');
            elements.fabEdit.classList.toggle('hidden', !(isArticleView && hasPermission('can_write_articles')));
        }
    }

    // =================================================================
    // === 5. SLIDER I LISTA ARTYKUŁÓW =================================
    // =================================================================
    function setupFeaturedSlider(articles) {
        if (articles.length === 0) {
            elements.slider.container.style.display = 'none';
            return;
        }
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
            // NAPRAWA: KROPKI SĄ TERAZ KLIKALNE
            navDot.onclick = () => {
                showSlide(index);
                startSlideInterval(); // Resetujemy timer po kliknięciu
            };
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

    function displayNewsList(articles) {
        elements.newsList.innerHTML = ''; 
        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'article-card';
            card.dataset.id = article.id;
            card.innerHTML = `<img src="${article.thumbnail}" alt="${article.title}"><div class="article-card-content"><h4>${article.title}</h4></div>`;
            elements.newsList.appendChild(card);
        });
    }

    function loadInitialArticles() {
        let query = database.ref('articles_meta').orderByChild('order').limitToFirst(ARTICLES_PER_PAGE);
        query.once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                elements.loadMoreArticlesBtn.classList.add('hidden');
                return;
            }
            const newArticles = Object.values(data).sort((a, b) => (a.order || 999) - (b.order || 999));
            state.allArticlesMeta = newArticles;
            state.lastLoadedArticleOrder = newArticles[newArticles.length - 1].order;

            displayNewsList(state.allArticlesMeta);
            const featured = state.allArticlesMeta.filter(a => a.featured);
            setupFeaturedSlider(featured);

            if (newArticles.length < ARTICLES_PER_PAGE) {
                state.areAllArticlesLoaded = true;
                elements.loadMoreArticlesBtn.classList.add('hidden');
            } else {
                elements.loadMoreArticlesBtn.classList.remove('hidden');
            }
        });
    }

    function loadMoreArticles() {
        if (state.areAllArticlesLoaded) return;
        elements.loadMoreArticlesBtn.disabled = true;
        elements.loadMoreArticlesBtn.textContent = 'Ładowanie...';

        let query = database.ref('articles_meta').orderByChild('order').startAfter(state.lastLoadedArticleOrder).limitToFirst(ARTICLES_PER_PAGE);
        query.once('value', snapshot => {
            const data = snapshot.val();
            if (!data) {
                state.areAllArticlesLoaded = true;
                elements.loadMoreArticlesBtn.classList.add('hidden');
                return;
            }
            const newArticles = Object.values(data).sort((a, b) => (a.order || 999) - (b.order || 999));
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

    // =================================================================
    // === 6. EDYTOR I ZARZĄDZANIE =====================================
    // =================================================================
    function openEditor(article = null) {
        if (!hasPermission('can_write_articles')) return alert("Brak uprawnień!");
        elements.userPanel.view.classList.add('hidden');
        elements.editorForm.form.reset();

        if (article) {
            elements.editorForm.idInput.value = article.id;
            elements.editorForm.orderInput.value = article.order || 99;
            elements.editorForm.dateInput.value = article.date;
            elements.editorForm.titleInput.value = article.title;
            elements.editorForm.authorInput.value = article.author;
            elements.editorForm.thumbnailInput.value = article.thumbnail;
            elements.editorForm.featuredCheckbox.checked = article.featured;
            elements.editorForm.deleteButton.classList.remove('hidden');
            database.ref(`articles_content/${article.id}`).once('value', s => {
                elements.editorForm.contentInput.value = s.val() ? s.val().content : '';
            });
        } else {
            elements.editorForm.idInput.value = Date.now();
            elements.editorForm.orderInput.value = 1;
            elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL');
            elements.editorForm.authorInput.value = state.currentUser ? state.currentUser.nick : 'Admin';
            elements.editorForm.deleteButton.classList.add('hidden');
        }
        Object.values(elements.views).forEach(v => v.classList.add('hidden'));
        elements.views.editor.classList.remove('hidden');
    }

    function saveArticle(e) {
        e.preventDefault();
        const id = elements.editorForm.idInput.value;
        const meta = {
            id: parseInt(id),
            order: parseInt(elements.editorForm.orderInput.value),
            date: elements.editorForm.dateInput.value,
            title: elements.editorForm.titleInput.value,
            author: elements.editorForm.authorInput.value,
            thumbnail: elements.editorForm.thumbnailInput.value,
            featured: elements.editorForm.featuredCheckbox.checked,
            lastUpdated: Date.now()
        };
        const content = { content: elements.editorForm.contentInput.value };
        const updates = {};
        updates[`/articles_meta/${id}`] = meta;
        updates[`/articles_content/${id}`] = content;

        database.ref().update(updates).then(() => {
            alert("Zapisano!");
            const idx = state.allArticlesMeta.findIndex(a => a.id == id);
            if(idx > -1) state.allArticlesMeta[idx] = meta;
            else state.allArticlesMeta.push(meta);
            state.allArticlesMeta.sort((a,b) => a.order - b.order);
            
            if(state.currentArticle && state.currentArticle.id == id) displayArticle(id);
            else {
                 showMainView();
                 displayNewsList(state.allArticlesMeta);
            }
        }).catch(e => alert("Błąd: " + e.message));
    }

    // =================================================================
    // === 7. PANEL UŻYTKOWNIKA I UI ===================================
    // =================================================================
    function populateRoleSelect() {
        const sel = elements.userPanel.adminRoleSelect;
        sel.innerHTML = '';
        Object.keys(state.rolesConfig).forEach(r => {
            sel.innerHTML += `<option value="${r}">${r}</option>`;
        });
    }

    function assignRole() {
        const nickToFind = elements.userPanel.adminNickInput.value.trim();
        const roleName = elements.userPanel.adminRoleSelect.value;
        if(!nickToFind) return alert("Podaj nick!");

        database.ref('users').orderByChild('nick').equalTo(nickToFind).once('value', snap => {
            if (!snap.exists()) return alert("Nie znaleziono takiego nicku!");
            const uid = Object.keys(snap.val())[0];
            database.ref(`users/${uid}/role`).set(roleName)
                .then(() => alert(`Nadano rangę ${roleName} dla ${nickToFind}`))
                .catch(e => alert(e.message));
        });
    }

    function updateUserInfoFields() {
        if (state.currentUser) {
            // NAPRAWA: GŁÓWNY PRZYCISK POKAZUJE INICJAŁ I KOLOR
            elements.userPanel.button.textContent = state.currentUser.nick.charAt(0).toUpperCase();
            elements.userPanel.button.style.backgroundColor = state.currentUser.color || '#4a68a5';

            elements.userPanel.nickSpan.textContent = state.currentUser.nick;
            elements.userPanel.userRoleBadge.textContent = state.currentUser.role || 'USER';
            elements.userPanel.profileNickInput.value = state.currentUser.nick;
            elements.userPanel.profileEmailInput.value = state.currentUser.email;
            elements.userPanel.profileColorInput.value = state.currentUser.color || '#ffffff';
            
            // NAPRAWA: NICK W KOMENTARZACH SIĘ WYPEŁNIA ALE JEST EDYTOWALNY
            elements.commentSection.nameInput.value = state.currentUser.nick;
            elements.commentSection.nameInput.disabled = false;

            elements.userPanel.infoView.classList.remove('hidden');
            elements.userPanel.authView.classList.add('hidden');
        } else {
            // GOŚĆ
            elements.userPanel.button.textContent = '?';
            elements.userPanel.button.style.backgroundColor = '#4a68a5';
            
            elements.commentSection.nameInput.value = '';
            elements.commentSection.nameInput.disabled = false;

            elements.userPanel.infoView.classList.add('hidden');
            elements.userPanel.authView.classList.remove('hidden');
        }
    }

    // =================================================================
    // === 8. INICJALIZACJA I EVENTY ===================================
    // =================================================================
    function bindEvents() {
        // TABS
        function switchTab(clickedBtn, contentToShow, groupBtns, groupContents) {
            Object.values(groupBtns).forEach(b => b.classList.remove('active'));
            Object.values(groupContents).forEach(c => c.classList.add('hidden'));
            clickedBtn.classList.add('active');
            contentToShow.classList.remove('hidden');
        }

        const profileBtns = { info: elements.userPanel.tabs.infoBtn, perms: elements.userPanel.tabs.permsBtn };
        const profileCont = { info: elements.userPanel.contents.info, perms: elements.userPanel.contents.perms };
        elements.userPanel.tabs.infoBtn.onclick = () => switchTab(elements.userPanel.tabs.infoBtn, elements.userPanel.contents.info, profileBtns, profileCont);
        elements.userPanel.tabs.permsBtn.onclick = () => switchTab(elements.userPanel.tabs.permsBtn, elements.userPanel.contents.perms, profileBtns, profileCont);

        const authBtns = { login: elements.userPanel.tabs.loginBtn, reg: elements.userPanel.tabs.registerBtn };
        const authCont = { login: elements.userPanel.contents.login, reg: elements.userPanel.contents.register };
        elements.userPanel.tabs.loginBtn.onclick = () => switchTab(elements.userPanel.tabs.loginBtn, elements.userPanel.contents.login, authBtns, authCont);
        elements.userPanel.tabs.registerBtn.onclick = () => switchTab(elements.userPanel.tabs.registerBtn, elements.userPanel.contents.register, authBtns, authCont);

        // Panel
        elements.userPanel.button.onclick = () => {
            updateUserInfoFields(); 
            elements.userPanel.view.classList.remove('hidden');
        };
        elements.userPanel.closePanelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.authCancelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.logoutBtn.onclick = () => { auth.signOut(); elements.userPanel.view.classList.add('hidden'); };

        // Zapis profilu
        elements.userPanel.profileInfoForm.onsubmit = (e) => {
            e.preventDefault();
            const newNick = elements.userPanel.profileNickInput.value.trim();
            const newColor = elements.userPanel.profileColorInput.value;
            const oldNick = state.currentUser.nick;

            const updates = {};
            updates[`users/${state.currentUser.uid}/nick`] = newNick;
            updates[`users/${state.currentUser.uid}/color`] = newColor;
            
            if(newNick.toLowerCase() !== oldNick.toLowerCase()) {
                updates[`takenNicks/${oldNick.toLowerCase()}`] = null;
                updates[`takenNicks/${newNick.toLowerCase()}`] = state.currentUser.uid;
            }

            database.ref().update(updates).then(() => {
                alert("Zapisano!");
                state.currentUser.nick = newNick;
                state.currentUser.color = newColor;
                updateUserInfoFields();
            }).catch(e => alert(e.message));
        };

        // Artykuły
        elements.loadMoreArticlesBtn.onclick = loadMoreArticles;
        elements.backButton.onclick = showMainView;
        document.body.addEventListener('click', e => {
            const card = e.target.closest('.article-card, .slide');
            if(card && !e.target.classList.contains('nav-dot')) { // Ignoruj kropki slidera
                displayArticle(card.dataset.id);
            }
        });

        // Auth
        elements.userPanel.loginEmail.closest('form').onsubmit = e => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(elements.userPanel.loginEmail.value, elements.userPanel.loginPassword.value)
                .then(() => elements.userPanel.view.classList.add('hidden'))
                .catch(e => alert(e.message));
        };
        elements.userPanel.registerEmail.closest('form').onsubmit = e => {
            e.preventDefault();
            const nick = elements.userPanel.registerNick.value.trim();
            database.ref(`takenNicks/${nick.toLowerCase()}`).once('value', s => {
                if(s.exists()) return alert("Nick zajęty!");
                auth.createUserWithEmailAndPassword(elements.userPanel.registerEmail.value, elements.userPanel.registerPassword.value)
                    .then(cred => {
                        const u = cred.user;
                        database.ref().update({
                            [`users/${u.uid}`]: { nick: nick, email: u.email, role: 'user', color: '#ffffff' },
                            [`takenNicks/${nick.toLowerCase()}`]: u.uid
                        });
                        elements.userPanel.view.classList.add('hidden');
                    }).catch(e => alert(e.message));
            });
        };
        
        // Admin
        elements.userPanel.adminAssignBtn.onclick = assignRole;
        elements.userPanel.roleSaveBtn.onclick = () => {
            const name = elements.userPanel.roleEditorName.value.trim().toLowerCase();
            if(!name) return;
            database.ref(`roles_config/${name}`).set({
                can_write_articles: elements.userPanel.rolePermWrite.checked,
                can_delete_comments: elements.userPanel.rolePermDelete.checked,
                can_manage_roles: elements.userPanel.rolePermManage.checked
            }).then(() => alert("Ranga zapisana!"));
        };

        if(elements.fabEdit) elements.fabEdit.onclick = () => openEditor(state.currentArticle);
        elements.userPanel.addNewArticleBtn.onclick = () => openEditor(null);
        elements.editorForm.cancelButton.onclick = () => {
             elements.views.editor.classList.add('hidden');
             if(state.currentArticle) elements.views.article.classList.remove('hidden');
             else elements.views.main.classList.remove('hidden');
        };
        elements.editorForm.form.onsubmit = saveArticle;
        
        // Komentarze
        elements.commentSection.form.onsubmit = (e) => {
            e.preventDefault();
            const msg = elements.commentSection.messageInput.value.trim();
            const author = state.currentUser ? state.currentUser.nick : elements.commentSection.nameInput.value; // Preferuj nick z konta, ale bierz input
            if(!msg || !author) return;
            
            const userId = state.currentUser ? state.currentUser.uid : state.localUserId;
            const color = state.currentUser ? (state.currentUser.color || '#fff') : '#fff';
            
            if(!state.currentUser) {
                 database.ref(`takenNicks/${author.toLowerCase()}`).once('value', s=> {
                     if(s.exists()) alert("Ten nick jest zarejestrowany. Zaloguj się!");
                     else pushComment();
                 });
            } else {
                 pushComment();
            }

            function pushComment() {
                database.ref(`comments/${state.currentArticle.id}`).push().set({
                    author: author, message: msg, userId: userId, userColor: color, timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                elements.commentSection.messageInput.value = '';
            }
        };

        // Obsługa usuwania komentarzy (delegacja zdarzeń)
        elements.commentSection.list.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-comment-btn')) {
                const commentEl = e.target.closest('.comment');
                const commentId = commentEl.dataset.commentId;
                if(confirm("Usunąć ten komentarz?")) {
                    database.ref(`comments/${state.currentArticle.id}/${commentId}`).remove();
                }
            }
        });
    }

    // === WIDOK ARTYKUŁU I KOMENTARZY ===
    function showMainView() {
        Object.values(elements.views).forEach(v => v.classList.add('hidden'));
        elements.views.main.classList.remove('hidden');
        elements.backButton.classList.add('hidden');
        state.currentArticle = null;
        updateUIForPermissions();
    }

    async function displayArticle(id) {
        let meta = state.allArticlesMeta.find(a => a.id == id);
        if(!meta) {
             try { const s = await database.ref(`articles_meta/${id}`).once('value'); meta = s.val(); } catch(e){}
        }
        if(!meta) return showMainView();
        
        state.currentArticle = meta;
        Object.values(elements.views).forEach(v => v.classList.add('hidden'));
        elements.views.article.classList.remove('hidden');
        elements.backButton.classList.remove('hidden');
        updateUIForPermissions();

        elements.articleDetail.date.textContent = meta.date;
        elements.articleDetail.author.textContent = meta.author;
        elements.articleDetail.content.innerHTML = "Ładowanie...";
        
        database.ref(`articles_content/${id}`).once('value', s => {
            const c = s.val() ? s.val().content : '';
            elements.articleDetail.content.innerHTML = c;
        });
        
        if(state.activeCommentsRef) state.activeCommentsRef.off();
        state.activeCommentsRef = database.ref(`comments/${id}`);
        state.activeCommentsRef.on('value', s => {
            const d = s.val() || {};
            renderComments(d);
        });
    }

    function renderComments(data) {
        elements.commentSection.list.innerHTML = '';
        if(!data) return;

        // Sortowanie po dacie (najnowsze na górze)
        const comments = Object.entries(data).map(([k,v]) => ({...v, id: k}))
                               .sort((a,b) => b.timestamp - a.timestamp);

        comments.forEach(comment => {
            const el = document.createElement('div');
            el.className = 'comment';
            el.dataset.commentId = comment.id;
            el.style.borderLeft = `3px solid ${comment.userColor || '#fff'}`;
            
            // NAPRAWA: LOGIKA USUWANIA KOMENTARZY
            // 1. Czy to mój komentarz? (Sprawdzamy UID dla zalogowanych LUB localUserId dla gości)
            const myId = state.currentUser ? state.currentUser.uid : state.localUserId;
            const isMyComment = comment.userId === myId;
            
            // 2. Czy mam uprawnienia moda/admina?
            const canModerate = hasPermission('can_delete_comments');
            
            let deleteBtn = '';
            if (isMyComment || canModerate) {
                deleteBtn = `<div class="comment-controls"><button class="delete-comment-btn">Usuń</button></div>`;
            }

            el.innerHTML = `
                <div class="comment-header">
                    <span style="color:${comment.userColor || '#fff'}">${comment.author}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p>${comment.message}</p>
                ${deleteBtn}
            `;
            elements.commentSection.list.appendChild(el);
        });
    }

    function init() {
        bindEvents();
        loadRolesConfig();
        loadInitialArticles();
        
        auth.onAuthStateChanged(async u => {
            state.currentUser = null;
            if(u) {
                const s = await database.ref(`users/${u.uid}`).once('value');
                state.currentUser = { uid: u.uid, ...s.val() };
            }
            updateUserInfoFields(); // Odśwież ikonę profilu
            calculatePermissions();
            // Jeśli jesteśmy w artykule, odśwież komentarze, żeby pojawiły się przyciski usuwania
            if(state.currentArticle) {
                 // Trigger re-render by reading once (or waiting for .on listener)
                 // Listener .on zajmie się tym automatycznie, ale przyciski 'delete' pojawią się przy następnym renderze
                 // Wymuśmy to manualnie jeśli trzeba, ale .on powinien wystarczyć.
            }
        });
    }

    init();
});
