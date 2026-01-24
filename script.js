window.addEventListener('load', () => {

    // === 1. KONFIGURACJA ===
    if (typeof firebase === 'undefined') return alert("Firebase Error");

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

    // === 2. ELEMENTY DOM ===
    const elements = {
        views: { main: document.getElementById('main-view'), article: document.getElementById('article-view'), editor: document.getElementById('editor-view'), userPanel: document.getElementById('user-panel-view') },
        backButton: document.getElementById('back-button'),
        newsList: document.getElementById('news-list-view'),
        loadMoreArticlesBtn: document.getElementById('load-more-articles-btn'),
        slider: { container: document.getElementById('featured-slider-container') },
        articleDetail: { date: document.getElementById('article-date'), author: document.getElementById('article-author'), content: document.getElementById('article-content'), likeButton: document.getElementById('like-button'), likeCount: document.getElementById('like-count'), shareButton: document.getElementById('share-button') },
        commentSection: { form: document.getElementById('comment-form'), nameInput: document.getElementById('comment-name'), messageInput: document.getElementById('comment-message'), list: document.getElementById('comments-list') },
        fabEdit: document.getElementById('fab-edit-article'),
        editorForm: { form: document.getElementById('editor-form'), idInput: document.getElementById('editor-id'), orderInput: document.getElementById('editor-order'), dateInput: document.getElementById('editor-date'), titleInput: document.getElementById('editor-title'), authorInput: document.getElementById('editor-author'), thumbnailInput: document.getElementById('editor-thumbnail'), featuredCheckbox: document.getElementById('editor-featured'), contentInput: document.getElementById('editor-content'), cancelButton: document.getElementById('editor-cancel'), deleteButton: document.getElementById('editor-delete') },
        userPanel: { 
            button: document.getElementById('user-panel-button'), view: document.getElementById('user-panel-view'), infoView: document.getElementById('user-info-view'), authView: document.getElementById('auth-view'),
            nickSpan: document.getElementById('user-info-nick'), userRoleBadge: document.getElementById('user-current-role-badge'), profileNickInput: document.getElementById('profile-nick-input'), profileColorInput: document.getElementById('profile-color-input'), profileEmailInput: document.getElementById('profile-email-input'), profileInfoForm: document.getElementById('profile-info-form'),
            tabs: { infoBtn: document.getElementById('show-info-tab'), permsBtn: document.getElementById('show-perms-tab'), loginBtn: document.getElementById('show-login-tab'), registerBtn: document.getElementById('show-register-tab') },
            contents: { info: document.getElementById('profile-info-content'), perms: document.getElementById('profile-perms-content'), login: document.getElementById('login-form'), register: document.getElementById('register-form') },
            adminNickInput: document.getElementById('admin-user-email'), adminRoleSelect: document.getElementById('admin-role-select'), adminAssignBtn: document.getElementById('admin-assign-role-btn'), roleEditorName: document.getElementById('role-editor-name'), rolePermWrite: document.getElementById('perm-write-articles'), rolePermDelete: document.getElementById('perm-delete-comments'), rolePermManage: document.getElementById('perm-manage-roles'), roleSaveBtn: document.getElementById('admin-save-role-btn'),
            loginEmail: document.getElementById('login-email'), loginPassword: document.getElementById('login-password'), registerNick: document.getElementById('register-nick'), registerEmail: document.getElementById('register-email'), registerPassword: document.getElementById('register-password'), logoutBtn: document.getElementById('user-panel-logout'), closePanelBtn: document.getElementById('user-panel-cancel'), authCancelBtn: document.getElementById('auth-cancel-button'), addNewArticleBtn: document.createElement('button')
        },
        langSwitcher: { current: document.querySelector('.current-lang'), dropdown: document.getElementById('lang-dropdown'), flag: document.getElementById('current-flag') }
    };
    
    // Dodanie przycisku w panelu admina
    if(document.querySelector('#profile-perms-content')) document.querySelector('#profile-perms-content').prepend(elements.userPanel.addNewArticleBtn);

    // === 3. STAN ===
    let localUserId = localStorage.getItem('localUserId') || `guest_${Math.random().toString(36).substr(2, 9)}`;
    try { localStorage.setItem('localUserId', localUserId); } catch(e){}

    let state = {
        allArticlesMeta: [], lastLoadedArticleOrder: null, areAllArticlesLoaded: false,
        allComments: [], activeCommentsRef: null, currentArticle: null, currentUser: null,
        localUserId: localUserId, rolesConfig: {},
        permissions: { can_write_articles: false, can_delete_comments: false, can_manage_roles: false },
        sliderInterval: null, currentSlideIndex: 0
    };

    // === 4. I18N (JĘZYKI) ===
    function initI18n() {
        i18next.init({
            lng: localStorage.getItem('lang') || 'pl',
            resources: resources // Zmienna z pliku translations.js
        }, function(err, t) {
            updateContent();
        });
    }

    function updateContent() {
        // Tłumaczenie tekstów w data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key.startsWith('[placeholder]')) {
                el.placeholder = i18next.t(key.replace('[placeholder]', ''));
            } else {
                el.textContent = i18next.t(key);
            }
        });

        // Aktualizacja flagi
        const lang = i18next.language;
        elements.langSwitcher.flag.src = lang === 'pl' ? "https://flagcdn.com/24x18/pl.png" : "https://flagcdn.com/24x18/gb.png";

        // Dynamiczne odświeżenie treści
        if(state.currentUser) {
            elements.userPanel.addNewArticleBtn.textContent = i18next.t('user_panel.add_new_article');
        }
    }

    function changeLanguage(lang) {
        i18next.changeLanguage(lang, () => {
            localStorage.setItem('lang', lang);
            updateContent();
            // Odśwież listę komentarzy (żeby przetłumaczyć daty itp jeśli trzeba)
            if(state.currentArticle) displayArticle(state.currentArticle.id);
            elements.langSwitcher.dropdown.classList.add('hidden');
        });
    }

    // === 5. LOGIKA ===
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
            const roleDef = state.rolesConfig[state.currentUser.role || 'user'];
            if (roleDef) state.permissions = roleDef;
        }
        updateUIForPermissions();
    }

    function hasPermission(perm) { return state.permissions[perm] === true; }

    function updateUIForPermissions() {
        elements.userPanel.tabs.permsBtn.classList.toggle('hidden', !hasPermission('can_manage_roles'));
        elements.userPanel.addNewArticleBtn.classList.toggle('hidden', !hasPermission('can_write_articles'));
        if (elements.fabEdit) {
            const isArticleView = !elements.views.article.classList.contains('hidden');
            elements.fabEdit.classList.toggle('hidden', !(isArticleView && hasPermission('can_write_articles')));
        }
    }

    // --- Slider & Lista ---
    function setupFeaturedSlider(articles) {
        if (articles.length === 0) { elements.slider.container.style.display = 'none'; return; }
        elements.slider.container.style.display = 'block';
        elements.slider.container.innerHTML = `<div class="slider-content"></div><div class="slider-nav"></div>`;
        const content = elements.slider.container.querySelector('.slider-content');
        const nav = elements.slider.container.querySelector('.slider-nav');
        articles.forEach((article, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide'; slide.dataset.id = article.id;
            slide.innerHTML = `<img src="${article.thumbnail}"><div class="slide-title">${article.title}</div>`;
            content.appendChild(slide);
            const navDot = document.createElement('span');
            navDot.className = 'nav-dot'; navDot.dataset.index = index;
            navDot.onclick = () => { showSlide(index); startSlideInterval(); };
            nav.appendChild(navDot);
        });
        showSlide(0); startSlideInterval();
    }
    function showSlide(index) {
        const slides = elements.slider.container.querySelectorAll('.slide');
        const dots = elements.slider.container.querySelectorAll('.nav-dot');
        if (!slides.length) return;
        if (index >= slides.length) index = 0; if (index < 0) index = slides.length - 1;
        slides.forEach(s => s.classList.remove('active')); dots.forEach(d => d.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active'); if (dots[index]) dots[index].classList.add('active');
        state.currentSlideIndex = index;
    }
    function startSlideInterval() { clearInterval(state.sliderInterval); state.sliderInterval = setInterval(() => showSlide(state.currentSlideIndex + 1), 8000); }

    function displayNewsList(articles) {
        elements.newsList.innerHTML = ''; 
        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'article-card'; card.dataset.id = article.id;
            card.innerHTML = `<img src="${article.thumbnail}"><div class="article-card-content"><h4>${article.title}</h4></div>`;
            elements.newsList.appendChild(card);
        });
    }

    function loadInitialArticles() {
        database.ref('articles_meta').orderByChild('order').limitToFirst(ARTICLES_PER_PAGE).once('value', snapshot => {
            const data = snapshot.val();
            if (!data) { elements.loadMoreArticlesBtn.classList.add('hidden'); return; }
            const newArticles = Object.values(data).sort((a, b) => (a.order || 999) - (b.order || 999));
            state.allArticlesMeta = newArticles;
            state.lastLoadedArticleOrder = newArticles[newArticles.length - 1].order;
            displayNewsList(state.allArticlesMeta);
            setupFeaturedSlider(state.allArticlesMeta.filter(a => a.featured));
            if (newArticles.length < ARTICLES_PER_PAGE) state.areAllArticlesLoaded = true;
            elements.loadMoreArticlesBtn.classList.toggle('hidden', state.areAllArticlesLoaded);
        });
    }

    function loadMoreArticles() {
        if (state.areAllArticlesLoaded) return;
        let query = database.ref('articles_meta').orderByChild('order').startAfter(state.lastLoadedArticleOrder).limitToFirst(ARTICLES_PER_PAGE);
        query.once('value', snapshot => {
            const data = snapshot.val();
            if (!data) { state.areAllArticlesLoaded = true; elements.loadMoreArticlesBtn.classList.add('hidden'); return; }
            const newArticles = Object.values(data).sort((a, b) => (a.order || 999) - (b.order || 999));
            state.allArticlesMeta.push(...newArticles);
            state.lastLoadedArticleOrder = newArticles[newArticles.length - 1].order;
            displayNewsList(state.allArticlesMeta);
            if (newArticles.length < ARTICLES_PER_PAGE) elements.loadMoreArticlesBtn.classList.add('hidden');
        });
    }

    // --- Edytor ---
    function openEditor(article = null) {
        if (!hasPermission('can_write_articles')) return alert(i18next.t('editor.error_permission'));
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
            database.ref(`articles_content/${article.id}`).once('value', s => elements.editorForm.contentInput.value = s.val() ? s.val().content : '');
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
            alert(i18next.t('editor.save_success'));
            const idx = state.allArticlesMeta.findIndex(a => a.id == id);
            if(idx > -1) state.allArticlesMeta[idx] = meta; else state.allArticlesMeta.push(meta);
            state.allArticlesMeta.sort((a,b) => a.order - b.order);
            if(state.currentArticle && state.currentArticle.id == id) displayArticle(id);
            else { showMainView(); displayNewsList(state.allArticlesMeta); }
        }).catch(e => alert("Error: " + e.message));
    }

    // === 6. EVENTY ===
    function bindEvents() {
        // I18N
        elements.langSwitcher.current.onclick = () => elements.langSwitcher.dropdown.classList.toggle('hidden');
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.onclick = () => changeLanguage(opt.dataset.lang);
        });

        // Tabs
        const switchTab = (clicked, show, allBtns, allCont) => {
            Object.values(allBtns).forEach(b => b.classList.remove('active'));
            Object.values(allCont).forEach(c => c.classList.add('hidden'));
            clicked.classList.add('active'); show.classList.remove('hidden');
        };
        elements.userPanel.tabs.infoBtn.onclick = () => switchTab(elements.userPanel.tabs.infoBtn, elements.userPanel.contents.info, elements.userPanel.tabs, {i: elements.userPanel.contents.info, p: elements.userPanel.contents.perms});
        elements.userPanel.tabs.permsBtn.onclick = () => switchTab(elements.userPanel.tabs.permsBtn, elements.userPanel.contents.perms, elements.userPanel.tabs, {i: elements.userPanel.contents.info, p: elements.userPanel.contents.perms});

        elements.userPanel.tabs.loginBtn.onclick = () => switchTab(elements.userPanel.tabs.loginBtn, elements.userPanel.contents.login, {l: elements.userPanel.tabs.loginBtn, r: elements.userPanel.tabs.registerBtn}, elements.userPanel.contents);
        elements.userPanel.tabs.registerBtn.onclick = () => switchTab(elements.userPanel.tabs.registerBtn, elements.userPanel.contents.register, {l: elements.userPanel.tabs.loginBtn, r: elements.userPanel.tabs.registerBtn}, elements.userPanel.contents);

        // Panel
        elements.userPanel.button.onclick = () => { updateUserInfoFields(); elements.userPanel.view.classList.remove('hidden'); };
        elements.userPanel.closePanelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.authCancelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.logoutBtn.onclick = () => { auth.signOut(); elements.userPanel.view.classList.add('hidden'); };

        // Artykuły
        window.addEventListener('hashchange', handleDeepLink);
        elements.backButton.onclick = () => window.location.hash = '';
        document.body.addEventListener('click', e => {
            const card = e.target.closest('.article-card, .slide');
            if(card && !e.target.classList.contains('nav-dot')) window.location.hash = `article-${card.dataset.id}`;
        });

        // Edytor (ZAPIS, ANULUJ, USUŃ)
        elements.editorForm.form.onsubmit = saveArticle;
        elements.editorForm.cancelButton.onclick = () => {
             elements.views.editor.classList.add('hidden');
             if(state.currentArticle) elements.views.article.classList.remove('hidden'); else elements.views.main.classList.remove('hidden');
        };
        // === NAPRAWA PRZYCISKU USUŃ ===
        elements.editorForm.deleteButton.onclick = () => {
            const id = elements.editorForm.idInput.value;
            if(!id) return;
            if(confirm(i18next.t('editor.confirm_delete'))) {
                const updates = {};
                updates[`/articles_meta/${id}`] = null;
                updates[`/articles_content/${id}`] = null;
                database.ref().update(updates).then(() => {
                    alert(i18next.t('editor.delete_success'));
                    state.allArticlesMeta = state.allArticlesMeta.filter(a => a.id != id);
                    showMainView();
                    displayNewsList(state.allArticlesMeta);
                }).catch(e => alert(e.message));
            }
        };

        if(elements.fabEdit) elements.fabEdit.onclick = () => openEditor(state.currentArticle);
        elements.userPanel.addNewArticleBtn.onclick = () => openEditor(null);

        // Share
        elements.articleDetail.shareButton.onclick = async () => {
            if (!state.currentArticle) return;
            const url = window.location.href;
            try {
                if (navigator.share) await navigator.share({title: state.currentArticle.title, url: url});
                else throw new Error('no share');
            } catch (e) {
                try { await navigator.clipboard.writeText(url); alert(i18next.t('article.link_copied')); } catch(err){ prompt("Copy:", url); }
            }
        };
    }

    function handleDeepLink() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#article-')) displayArticle(hash.substring(9));
        else showMainView();
    }

    function updateUserInfoFields() {
        if (state.currentUser) {
            elements.userPanel.button.textContent = state.currentUser.nick.charAt(0).toUpperCase();
            elements.userPanel.button.style.backgroundColor = state.currentUser.color || '#4a68a5';
            elements.userPanel.nickSpan.textContent = state.currentUser.nick;
            elements.userPanel.userRoleBadge.textContent = state.currentUser.role || 'USER';
            
            elements.userPanel.addNewArticleBtn.textContent = i18next.t('user_panel.add_new_article');
            elements.userPanel.addNewArticleBtn.style.backgroundColor = "#28a745";
            
            elements.userPanel.infoView.classList.remove('hidden');
            elements.userPanel.authView.classList.add('hidden');
        } else {
            elements.userPanel.button.textContent = '?';
            elements.userPanel.button.style.backgroundColor = '#4a68a5';
            elements.userPanel.infoView.classList.add('hidden');
            elements.userPanel.authView.classList.remove('hidden');
        }
    }

    // === START ===
    function init() {
        initI18n();
        bindEvents();
        loadRolesConfig();
        loadInitialArticles();
        
        auth.onAuthStateChanged(async u => {
            state.currentUser = null;
            if(u) {
                const s = await database.ref(`users/${u.uid}`).once('value');
                state.currentUser = { uid: u.uid, ...s.val() };
            }
            updateUserInfoFields();
            calculatePermissions();
        });
        
        // Komentarze
        elements.commentSection.form.onsubmit = e => {
            e.preventDefault();
            const msg = elements.commentSection.messageInput.value.trim();
            const author = state.currentUser ? state.currentUser.nick : elements.commentSection.nameInput.value;
            const uid = state.currentUser ? state.currentUser.uid : state.localUserId;
            if(!msg || !author) return;
            database.ref(`comments/${state.currentArticle.id}`).push().set({
                author, message: msg, userId: uid, userColor: state.currentUser?.color||'#fff', timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            elements.commentSection.messageInput.value = '';
        };
    }
    init();
});
