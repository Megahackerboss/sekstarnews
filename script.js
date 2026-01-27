window.addEventListener('load', () => {

    // === 1. KONFIGURACJA ===
    if (typeof firebase === 'undefined') {
        console.error("Błąd: Firebase nie został załadowany.");
        return;
    }

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
            list: document.getElementById('comments-list') 
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
            // Uwaga: Button obsługiwany przez delegację, ale zachowujemy referencję do aktualizacji tekstu
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

            adminNickInput: document.getElementById('admin-user-email'), 
            adminRoleSelect: document.getElementById('admin-role-select'),
            adminAssignBtn: document.getElementById('admin-assign-role-btn'),
            roleEditorName: document.getElementById('role-editor-name'),
            rolePermWrite: document.getElementById('perm-write-articles'),
            rolePermDelete: document.getElementById('perm-delete-comments'),
            rolePermManage: document.getElementById('perm-manage-roles'),
            roleSaveBtn: document.getElementById('admin-save-role-btn'),
            
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
        langSwitcher: { 
            current: document.querySelector('.current-lang'), 
            dropdown: document.getElementById('lang-dropdown'), 
            flag: document.getElementById('current-flag') 
        },
        clearCacheBtn: document.getElementById('clear-cache-btn')
    };

    // Konfiguracja przycisku "Dodaj artykuł"
    elements.userPanel.addNewArticleBtn.textContent = "+ Utwórz Nowy Artykuł";
    elements.userPanel.addNewArticleBtn.style.backgroundColor = "#28a745";
    elements.userPanel.addNewArticleBtn.style.marginTop = "10px";
    elements.userPanel.addNewArticleBtn.className = "hidden";
    if(document.querySelector('#profile-perms-content')) {
        document.querySelector('#profile-perms-content').prepend(elements.userPanel.addNewArticleBtn);
    }

    // === 3. STAN APLIKACJI ===
    let localUserId;
    try {
        localUserId = localStorage.getItem('localUserId');
        if (!localUserId) {
            localUserId = `guest_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('localUserId', localUserId);
        }
    } catch (e) {
        localUserId = `guest_temp_${Math.random().toString(36).substr(2, 9)}`;
    }

    let state = {
        allArticlesMeta: [],
        lastLoadedArticleOrder: null,
        areAllArticlesLoaded: false,
        allComments: [],
        activeCommentsRef: null,
        currentArticle: null,
        currentUser: null,
        localUserId: localUserId,
        rolesConfig: {},
        permissions: { can_write_articles: false, can_delete_comments: false, can_manage_roles: false },
        sliderInterval: null,
        currentSlideIndex: 0
    };

    // === 4. I18N ===
    function initI18n() {
        if (typeof i18next === 'undefined') return;
        i18next.init({
            lng: localStorage.getItem('lang') || 'pl',
            resources: typeof resources !== 'undefined' ? resources : { pl: { translation: {} }, en: { translation: {} } }
        }, function(err, t) {
            updateContent();
        });
    }

    function updateContent() {
        if (typeof i18next === 'undefined') return;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key.startsWith('[placeholder]')) {
                el.placeholder = i18next.t(key.replace('[placeholder]', ''));
            } else {
                el.textContent = i18next.t(key);
            }
        });

        const lang = i18next.language;
        if(elements.langSwitcher.flag) {
            elements.langSwitcher.flag.src = lang === 'pl' ? "https://flagcdn.com/24x18/pl.png" : "https://flagcdn.com/24x18/gb.png";
        }
        
        if(state.currentUser && elements.userPanel.addNewArticleBtn) {
            elements.userPanel.addNewArticleBtn.textContent = i18next.t('user_panel.add_new_article');
        }
    }

    function changeLanguage(lang) {
        if (typeof i18next === 'undefined') return;
        i18next.changeLanguage(lang, () => {
            localStorage.setItem('lang', lang);
            updateContent();
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

    function populateRoleSelect() {
        const sel = elements.userPanel.adminRoleSelect;
        if(!sel) return;
        sel.innerHTML = '';
        Object.keys(state.rolesConfig).forEach(r => {
            sel.innerHTML += `<option value="${r}">${r}</option>`;
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
        elements.userPanel.tabs.permsBtn.classList.toggle('hidden', !hasPermission('can_manage_roles'));
        elements.userPanel.addNewArticleBtn.classList.toggle('hidden', !hasPermission('can_write_articles'));
        if (elements.fabEdit) {
            const isArticleView = !elements.views.article.classList.contains('hidden');
            elements.fabEdit.classList.toggle('hidden', !(isArticleView && hasPermission('can_write_articles')));
        }
    }

    function updateUserInfoFields() {
        // Sprawdź czy element istnieje (zabezpieczenie)
        if (!elements.userPanel.button) return;

        if (state.currentUser) {
            elements.userPanel.button.textContent = state.currentUser.nick.charAt(0).toUpperCase();
            elements.userPanel.button.style.backgroundColor = state.currentUser.color || '#4a68a5';

            elements.userPanel.nickSpan.textContent = state.currentUser.nick;
            elements.userPanel.userRoleBadge.textContent = state.currentUser.role || 'USER';
            elements.userPanel.profileNickInput.value = state.currentUser.nick;
            elements.userPanel.profileEmailInput.value = state.currentUser.email;
            elements.userPanel.profileColorInput.value = state.currentUser.color || '#ffffff';
            
            elements.commentSection.nameInput.value = state.currentUser.nick;
            elements.commentSection.nameInput.disabled = false;

            elements.userPanel.infoView.classList.remove('hidden');
            elements.userPanel.authView.classList.add('hidden');
        } else {
            elements.userPanel.button.textContent = '?';
            elements.userPanel.button.style.backgroundColor = '#4a68a5';
            
            elements.commentSection.nameInput.value = '';
            elements.commentSection.nameInput.disabled = false;

            elements.userPanel.infoView.classList.add('hidden');
            elements.userPanel.authView.classList.remove('hidden');
        }
        
        if(typeof i18next !== 'undefined') {
            elements.userPanel.addNewArticleBtn.textContent = i18next.t('user_panel.add_new_article');
        }
    }

    // === ARTYKUŁY I SLIDER ===
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
            // Obsługa kliknięcia kropki - DELEGACJA jest niżej, ale tutaj też zadziała dzięki onclick
            navDot.onclick = (e) => { 
                e.stopPropagation(); 
                showSlide(index); 
                startSlideInterval(); 
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

    // --- EDYTOR ---
    function openEditor(article = null) {
        if (!hasPermission('can_write_articles')) return alert(i18next.t('editor.error_permission') || "Brak uprawnień!");
        elements.userPanel.view.classList.add('hidden');
        elements.editorForm.form.reset();
        
        // Funkcja pomocnicza do ustawiania TinyMCE
        const setTinyContent = (html) => {
            if (tinymce.get('editor-content')) {
                tinymce.get('editor-content').setContent(html);
            } else {
                elements.editorForm.contentInput.value = html;
            }
        };

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
                setTinyContent(s.val() ? s.val().content : '');
            });
        } else {
            elements.editorForm.idInput.value = Date.now();
            elements.editorForm.orderInput.value = 1;
            elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL');
            elements.editorForm.authorInput.value = state.currentUser ? state.currentUser.nick : 'Admin';
            elements.editorForm.deleteButton.classList.add('hidden');
            setTinyContent('');
        }
        Object.values(elements.views).forEach(v => v.classList.add('hidden'));
        elements.views.editor.classList.remove('hidden');
    }

    function saveArticle(e) {
        e.preventDefault();
        
        // Zapisz TinyMCE
        if (tinymce.get('editor-content')) tinymce.triggerSave();

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
        
        let contentHtml = '';
        if (tinymce.get('editor-content')) {
            contentHtml = tinymce.get('editor-content').getContent();
        } else {
            contentHtml = elements.editorForm.contentInput.value;
        }

        const content = { content: contentHtml };
        const updates = {};
        updates[`/articles_meta/${id}`] = meta;
        updates[`/articles_content/${id}`] = content;

        database.ref().update(updates).then(() => {
            alert(i18next.t('editor.save_success') || "Zapisano!");
            const idx = state.allArticlesMeta.findIndex(a => a.id == id);
            if(idx > -1) state.allArticlesMeta[idx] = meta; else state.allArticlesMeta.push(meta);
            state.allArticlesMeta.sort((a,b) => a.order - b.order);
            if(state.currentArticle && state.currentArticle.id == id) displayArticle(id);
            else { showMainView(); displayNewsList(state.allArticlesMeta); }
            
            // Zamknij edytor po zapisie
            elements.views.editor.classList.add('hidden');
            if(state.currentArticle) elements.views.article.classList.remove('hidden'); 
            else elements.views.main.classList.remove('hidden');

        }).catch(e => alert("Error: " + e.message));
    }

    // --- WIDOKI ---
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
        elements.articleDetail.content.innerHTML = i18next.t('article.loading') || "Ładowanie...";
        
        database.ref(`articles/${id}/likes`).on('value', s => {
            elements.articleDetail.likeCount.textContent = s.val() || 0;
            try {
                const liked = localStorage.getItem(`liked_${id}`) === 'true';
                if(liked) elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♥️';
                else elements.articleDetail.likeButton.querySelector('.heart-icon').textContent = '♡';
            } catch(e){}
        });

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

        const comments = Object.entries(data).map(([k,v]) => ({...v, id: k}))
                               .sort((a,b) => b.timestamp - a.timestamp);

        comments.forEach(comment => {
            const el = document.createElement('div');
            el.className = 'comment';
            el.dataset.commentId = comment.id;
            el.style.borderLeft = `3px solid ${comment.userColor || '#fff'}`;
            
            const myId = state.currentUser ? state.currentUser.uid : state.localUserId;
            const isMyComment = comment.userId === myId;
            const canModerate = hasPermission('can_delete_comments');
            
            let controls = '';
            if (isMyComment || canModerate) {
                controls = `<div class="comment-controls">`;
                if(isMyComment) controls += `<button class="edit-comment-btn" data-i18n="article.edit_comment">${i18next.t('article.edit_comment')||'Edytuj'}</button>`;
                controls += `<button class="delete-comment-btn" data-i18n="article.delete_comment">${i18next.t('article.delete_comment')||'Usuń'}</button></div>`;
            }

            el.innerHTML = `
                <div class="comment-header">
                    <span style="color:${comment.userColor || '#fff'}">${comment.author}</span>
                    <span class="comment-date">${new Date(comment.timestamp).toLocaleString()}</span>
                </div>
                <p class="comment-message">${parseCommentFormatting(comment.message)}</p>
                ${controls}
            `;
            elements.commentSection.list.appendChild(el);
        });
    }

    function parseCommentFormatting(text) {
        if(!text) return "";
        let safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return safeText.replace(/\*(.*?)\*/g, '<i>$1</i>');
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

    // =================================================================
    // === 8. EVENTY (GLOBALNA DELEGACJA) - NAPRAWA 0.5s GLITCHA ===
    // =================================================================
    function bindEvents() {
        
        // --- DELEGACJA ZDARZEŃ DLA CAŁEGO DOKUMENTU ---
        // To jest najważniejsza zmiana. Nasłuchujemy kliknięć globalnie.
        // Niezależnie od tego, czy przycisk załaduje się po 0.1s czy 5s,
        // czy zostanie podmieniony - to zawsze zadziała.
        
        document.addEventListener('click', (e) => {
            const target = e.target;

            // 1. Przycisk Profilu (Otwórz Panel)
            if (target.closest('#user-panel-button')) {
                updateUserInfoFields();
                elements.userPanel.view.classList.remove('hidden');
                return;
            }

            // 2. Przycisk Wstecz
            if (target.closest('#back-button')) {
                window.location.hash = '';
                return;
            }

            // 3. Karty Artykułów i Slajdy (Nawigacja)
            const card = target.closest('.article-card, .slide');
            if (card && !target.classList.contains('nav-dot')) {
                window.location.hash = `article-${card.dataset.id}`;
                return;
            }

            // 4. Edycja / Nowy Artykuł
            if (target.closest('#fab-edit-article')) {
                openEditor(state.currentArticle);
                return;
            }
            if (target === elements.userPanel.addNewArticleBtn) { // Porównanie elementu JS
                openEditor(null);
                return;
            }

            // 5. Język
            if (target.closest('.current-lang')) {
                elements.langSwitcher.dropdown.classList.toggle('hidden');
                return;
            }
            if (target.closest('.lang-option')) {
                const lang = target.closest('.lang-option').dataset.lang;
                changeLanguage(lang);
                return;
            }
            
            // 6. Lightbox
            const lightbox = document.getElementById('image-lightbox');
            if (lightbox && !lightbox.classList.contains('hidden')) {
                if (target.id === 'lightbox-close' || target.id === 'image-lightbox') {
                    lightbox.classList.add('hidden');
                }
            }
            // Otwieranie Lightboxa (kliknięcie w obrazek w artykule)
            if (target.tagName === 'IMG' && target.closest('#article-content')) {
                const lbImg = document.getElementById('lightbox-img');
                if(lightbox && lbImg) {
                    lbImg.src = target.src;
                    lightbox.classList.remove('hidden');
                }
            }
        });

        // --- OBSŁUGA FORMULARZY I INNYCH ---
        
        // Zapis Edytora
        elements.editorForm.form.onsubmit = saveArticle;
        elements.editorForm.cancelButton.onclick = () => {
             elements.views.editor.classList.add('hidden');
             if(state.currentArticle) elements.views.article.classList.remove('hidden'); else elements.views.main.classList.remove('hidden');
        };
        elements.editorForm.deleteButton.onclick = () => {
            const id = elements.editorForm.idInput.value;
            if(!id) return;
            if(confirm(i18next.t('editor.confirm_delete') || "Usunąć?")) {
                const updates = {};
                updates[`/articles_meta/${id}`] = null;
                updates[`/articles_content/${id}`] = null;
                database.ref().update(updates).then(() => {
                    alert(i18next.t('editor.delete_success') || "Usunięto!");
                    state.allArticlesMeta = state.allArticlesMeta.filter(a => a.id != id);
                    showMainView();
                    displayNewsList(state.allArticlesMeta);
                }).catch(e => alert(e.message));
            }
        };

        // Panel Użytkownika - Zamknij/Wyloguj
        elements.userPanel.closePanelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.authCancelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.logoutBtn.onclick = () => { auth.signOut(); elements.userPanel.view.classList.add('hidden'); };

        // Tabs
        const switchTab = (clicked, show, allBtns, allCont) => {
            Object.values(allBtns).forEach(b => b.classList.remove('active'));
            Object.values(allCont).forEach(c => c.classList.add('hidden'));
            clicked.classList.add('active'); show.classList.remove('hidden');
        };
        const pBtns = elements.userPanel.tabs, pCont = elements.userPanel.contents;
        pBtns.infoBtn.onclick = () => switchTab(pBtns.infoBtn, pCont.info, pBtns, {i:pCont.info, p:pCont.perms});
        pBtns.permsBtn.onclick = () => switchTab(pBtns.permsBtn, pCont.perms, pBtns, {i:pCont.info, p:pCont.perms});
        const aBtns = {l:pBtns.loginBtn, r:pBtns.registerBtn}, aCont = {l:pCont.login, r:pCont.register};
        pBtns.loginBtn.onclick = () => switchTab(pBtns.loginBtn, pCont.login, aBtns, aCont);
        pBtns.registerBtn.onclick = () => switchTab(pBtns.registerBtn, pCont.register, aBtns, aCont);

        // Formularze Auth i Profil
        elements.userPanel.loginEmail.closest('form').onsubmit = e => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(elements.userPanel.loginEmail.value, elements.userPanel.loginPassword.value)
                .then(() => elements.userPanel.view.classList.add('hidden')).catch(e => alert(e.message));
        };
        elements.userPanel.registerEmail.closest('form').onsubmit = e => {
            e.preventDefault();
            const nick = elements.userPanel.registerNick.value.trim();
            database.ref(`takenNicks/${nick.toLowerCase()}`).once('value', s => {
                if(s.exists()) return alert(i18next.t('alerts.nick_taken') || "Nick zajęty");
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
        elements.userPanel.profileInfoForm.onsubmit = e => {
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
                alert(i18next.t('alerts.saved') || "Zapisano");
                state.currentUser.nick = newNick; state.currentUser.color = newColor;
                updateUserInfoFields();
            }).catch(e => alert(e.message));
        };

        // Admin
        elements.userPanel.adminAssignBtn.onclick = () => {
            const nick = elements.userPanel.adminNickInput.value.trim();
            const role = elements.userPanel.adminRoleSelect.value;
            if(!nick) return alert(i18next.t('alerts.enter_nick') || "Podaj nick");
            database.ref('users').orderByChild('nick').equalTo(nick).once('value', snap => {
                if (!snap.exists()) return alert(i18next.t('alerts.user_not_found') || "Brak usera");
                const uid = Object.keys(snap.val())[0];
                database.ref(`users/${uid}/role`).set(role).then(() => alert(`${i18next.t('alerts.rank_assigned')}: ${role}`)).catch(e => alert(e.message));
            });
        };
        elements.userPanel.roleSaveBtn.onclick = () => {
            const name = elements.userPanel.roleEditorName.value.trim().toLowerCase();
            if(!name) return;
            database.ref(`roles_config/${name}`).set({
                can_write_articles: elements.userPanel.rolePermWrite.checked,
                can_delete_comments: elements.userPanel.rolePermDelete.checked,
                can_manage_roles: elements.userPanel.rolePermManage.checked
            }).then(() => alert(i18next.t('alerts.saved') || "Zapisano"));
        };

        // Komentarze
        elements.commentSection.form.onsubmit = e => {
            e.preventDefault();
            const msg = elements.commentSection.messageInput.value.trim();
            const author = state.currentUser ? state.currentUser.nick : elements.commentSection.nameInput.value;
            const uid = state.currentUser ? state.currentUser.uid : state.localUserId;
            if(!msg || !author) return;
            
            const pushC = () => {
                database.ref(`comments/${state.currentArticle.id}`).push().set({
                    author, message: msg, userId: uid, userColor: state.currentUser?.color||'#fff', timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                elements.commentSection.messageInput.value = '';
            };
            
            if(!state.currentUser) {
                 database.ref(`takenNicks/${author.toLowerCase()}`).once('value', s=> {
                     if(s.exists()) alert(i18next.t('alerts.nick_registered') || "Zaloguj się"); else pushC();
                 });
            } else pushC();
        };

        // Delegacja dla komentarzy (Edit/Delete)
        elements.commentSection.list.addEventListener('click', (e) => {
            const commentEl = e.target.closest('.comment');
            if(!commentEl) return;
            const commentId = commentEl.dataset.commentId;

            // Delete
            if (e.target.classList.contains('delete-comment-btn')) {
                if(confirm(i18next.t('alerts.confirm_delete_comment') || "Usunąć?")) {
                    database.ref(`comments/${state.currentArticle.id}/${commentId}`).remove();
                }
            }
            // Edit
            if (e.target.classList.contains('edit-comment-btn')) {
                const messageP = commentEl.querySelector('.comment-message');
                const controlsDiv = commentEl.querySelector('.comment-controls');
                const currentText = messageP.innerText;
                messageP.style.display = 'none'; controlsDiv.style.display = 'none';
                
                const wrap = document.createElement('div'); wrap.className = 'edit-wrapper';
                const ta = document.createElement('textarea'); ta.value = currentText; ta.className = 'comment-edit-textarea'; ta.style.width='100%';
                const save = document.createElement('button'); save.textContent = i18next.t('article.save_comment')||"Zapisz"; save.style.marginRight='5px';
                const cancel = document.createElement('button'); cancel.textContent = i18next.t('article.cancel_comment')||"Anuluj";
                
                wrap.appendChild(ta); wrap.appendChild(save); wrap.appendChild(cancel); commentEl.appendChild(wrap);
                save.onclick = () => { if(ta.value.trim()) database.ref(`comments/${state.currentArticle.id}/${commentId}/message`).set(ta.value.trim()); };
                cancel.onclick = () => { messageP.style.display = 'block'; controlsDiv.style.display = 'block'; wrap.remove(); };
            }
        });

        // Udostępnianie
        elements.articleDetail.shareButton.onclick = async () => {
            if (!state.currentArticle) return;
            const url = window.location.href;
            try {
                if (navigator.share) await navigator.share({title: state.currentArticle.title, url: url});
                else throw new Error('no share');
            } catch (e) {
                try { await navigator.clipboard.writeText(url); alert(i18next.t('article.link_copied') || "Skopiowano!"); } catch(err){ prompt("Copy:", url); }
            }
        };
        
        // Cache
        if(elements.clearCacheBtn) elements.clearCacheBtn.onclick = () => {
            Object.keys(localStorage).forEach(k => { if(k.startsWith('article_')) localStorage.removeItem(k); });
            alert("Cache cleared");
        };
    }

    // === 9. TINYMCE INIT ===
    function initEditor() {
        if (typeof tinymce !== 'undefined') {
            if (tinymce.get('editor-content')) tinymce.remove('#editor-content');
            tinymce.init({
                selector: '#editor-content',
                height: '100%', resize: false, menubar: true, promotion: false, branding: false,
                base_url: 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.2', suffix: '.min',
                skin: 'oxide-dark', content_css: 'dark',
                plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
                toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | image code',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:16px; background-color: #20385a; color: #ffffff; padding: 15px; } a { color: #ffdd4b; }'
            });
        }
    }

    // === 10. INIT ===
    function init() {
        initI18n();
        bindEvents();
        initEditor();
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
        
        handleDeepLink();
    }

    init();
});
