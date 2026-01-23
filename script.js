document.addEventListener('DOMContentLoaded', () => {

    // === 1. KONFIGURACJA ===
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
            // Widoki wewnątrz panelu
            infoView: document.getElementById('user-info-view'),
            authView: document.getElementById('auth-view'),
            
            // Pola profilu
            nickSpan: document.getElementById('user-info-nick'),
            userRoleBadge: document.getElementById('user-current-role-badge'),
            profileNickInput: document.getElementById('profile-nick-input'),
            profileColorInput: document.getElementById('profile-color-input'),
            profileEmailInput: document.getElementById('profile-email-input'),
            profileInfoForm: document.getElementById('profile-info-form'),
            
            // Zakładki
            tabs: document.querySelectorAll('.profile-tabs button, .auth-tabs button'),
            contents: {
                info: document.getElementById('profile-info-content'),
                perms: document.getElementById('profile-perms-content'),
                login: document.getElementById('login-form'),
                register: document.getElementById('register-form')
            },

            // Admin Panel
            adminEmailInput: document.getElementById('admin-user-email'), // Zostawiamy ID w HTML, ale używamy jako NICK
            adminRoleSelect: document.getElementById('admin-role-select'),
            adminAssignBtn: document.getElementById('admin-assign-role-btn'),
            roleEditorName: document.getElementById('role-editor-name'),
            rolePermWrite: document.getElementById('perm-write-articles'),
            rolePermDelete: document.getElementById('perm-delete-comments'),
            rolePermManage: document.getElementById('perm-manage-roles'),
            roleSaveBtn: document.getElementById('admin-save-role-btn'),
            
            // Auth form inputs
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            registerNick: document.getElementById('register-nick'),
            registerEmail: document.getElementById('register-email'),
            registerPassword: document.getElementById('register-password'),
            
            logoutBtn: document.getElementById('user-panel-logout'),
            closePanelBtn: document.getElementById('user-panel-cancel'),
            authCancelBtn: document.getElementById('auth-cancel-button'),
            
            // NOWY PRZYCISK
            addNewArticleBtn: document.createElement('button') 
        },
        clearCacheBtn: document.getElementById('clear-cache-btn')
    };

    // Dodanie przycisku "Dodaj artykuł" do panelu admina
    elements.userPanel.addNewArticleBtn.textContent = "+ Utwórz Nowy Artykuł";
    elements.userPanel.addNewArticleBtn.style.backgroundColor = "#28a745";
    elements.userPanel.addNewArticleBtn.style.marginTop = "10px";
    elements.userPanel.addNewArticleBtn.className = "hidden"; // Domyślnie ukryty
    // Wstawiamy go pod sekcją zarządzania użytkownikami
    document.querySelector('#profile-perms-content').prepend(elements.userPanel.addNewArticleBtn);

    // === 3. STAN ===
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
        permissions: { can_write_articles: false, can_delete_comments: false, can_manage_roles: false }
    };
    if(!localStorage.getItem('localUserId')) localStorage.setItem('localUserId', state.localUserId);

    // === 4. LOGIKA UPRAWNIEŃ ===
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
        // Zakładka uprawnień
        const permsTab = document.getElementById('show-perms-tab');
        if (permsTab) permsTab.classList.toggle('hidden', !hasPermission('can_manage_roles'));

        // Przycisk "Dodaj artykuł" w panelu
        elements.userPanel.addNewArticleBtn.classList.toggle('hidden', !hasPermission('can_write_articles'));

        // FAB (Ołówek)
        if (elements.fabEdit) {
            const isArticleView = !elements.views.article.classList.contains('hidden');
            elements.fabEdit.classList.toggle('hidden', !(isArticleView && hasPermission('can_write_articles')));
        }
    }

    // === 5. EDYTOR ===
    function openEditor(article = null) {
        if (!hasPermission('can_write_articles')) return alert("Brak uprawnień!");
        
        elements.userPanel.view.classList.add('hidden'); // Schowaj panel usera
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
            // Nowy
            elements.editorForm.idInput.value = Date.now();
            elements.editorForm.orderInput.value = 1;
            elements.editorForm.dateInput.value = new Date().toLocaleString('pl-PL');
            elements.editorForm.authorInput.value = state.currentUser.nick;
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

        database.ref().update(updates)
            .then(() => {
                alert("Zapisano!");
                // Odśwież listę lokalnie
                const idx = state.allArticlesMeta.findIndex(a => a.id == id);
                if(idx > -1) state.allArticlesMeta[idx] = meta;
                else state.allArticlesMeta.push(meta);
                
                // Jeśli edytowaliśmy bieżący, odśwież widok
                if(state.currentArticle && state.currentArticle.id == id) displayArticle(id);
                else showMainView();
            })
            .catch(e => alert("Błąd zapisu: " + e.message + "\nSprawdź czy masz rangę w bazie!"));
    }

    // === 6. ZARZĄDZANIE ROLEMI (PO NICKU) ===
    function populateRoleSelect() {
        const sel = elements.userPanel.adminRoleSelect;
        sel.innerHTML = '';
        Object.keys(state.rolesConfig).forEach(r => {
            sel.innerHTML += `<option value="${r}">${r}</option>`;
        });
    }

    function assignRole() {
        // Zmieniliśmy ID inputa w HTML na 'admin-user-email', ale traktujemy go jako NICK
        const nickToFind = elements.userPanel.adminEmailInput.value.trim(); 
        const roleName = elements.userPanel.adminRoleSelect.value;
        
        if(!nickToFind) return alert("Podaj nick!");

        // Szukamy UID po niku
        database.ref('users').orderByChild('nick').equalTo(nickToFind).once('value', snap => {
            if (!snap.exists()) return alert("Nie znaleziono użytkownika o takim niku!");
            
            const uid = Object.keys(snap.val())[0];
            database.ref(`users/${uid}/role`).set(roleName)
                .then(() => alert(`Nadano rangę ${roleName} dla ${nickToFind}`))
                .catch(e => alert(e.message));
        });
    }

    // === 7. UI I NAWIGACJA ===
    function showMainView() {
        Object.values(elements.views).forEach(v => v.classList.add('hidden'));
        elements.views.main.classList.remove('hidden');
        elements.backButton.classList.add('hidden');
        state.currentArticle = null;
        updateUIForPermissions(); // Ukryj FAB
    }

    async function displayArticle(id) {
        let meta = state.allArticlesMeta.find(a => a.id == id);
        if(!meta) {
            try {
                const s = await database.ref(`articles_meta/${id}`).once('value');
                meta = s.val();
                if(meta) state.allArticlesMeta.push(meta);
            } catch(e) {}
        }
        if(!meta) return showMainView();

        state.currentArticle = meta;
        Object.values(elements.views).forEach(v => v.classList.add('hidden'));
        elements.views.article.classList.remove('hidden');
        elements.backButton.classList.remove('hidden');
        updateUIForPermissions(); // Pokaż FAB

        elements.articleDetail.date.textContent = meta.date;
        elements.articleDetail.author.textContent = meta.author;
        
        // Cache content
        const cached = JSON.parse(localStorage.getItem(`article_${id}`));
        if(cached && cached.lastUpdated >= meta.lastUpdated) {
            elements.articleDetail.content.innerHTML = cached.content;
        } else {
            elements.articleDetail.content.innerHTML = "Ładowanie...";
            database.ref(`articles_content/${id}`).once('value', s => {
                const c = s.val() ? s.val().content : '';
                elements.articleDetail.content.innerHTML = c;
                localStorage.setItem(`article_${id}`, JSON.stringify({content: c, lastUpdated: meta.lastUpdated}));
            });
        }
        
        listenForComments(id);
    }

    // === 8. INICJALIZACJA ===
    function bindEvents() {
        // Panel Admina - Zmiana Etykiety
        const label = document.querySelector('label[for="admin-user-email"]');
        if(label) label.textContent = "Zmień rangę użytkownika (wpisz NICK):";

        // Tab switching
        document.getElementById('show-login-tab').onclick = () => {
            elements.userPanel.contents.login.classList.remove('hidden');
            elements.userPanel.contents.register.classList.add('hidden');
        };
        document.getElementById('show-register-tab').onclick = () => {
            elements.userPanel.contents.login.classList.add('hidden');
            elements.userPanel.contents.register.classList.remove('hidden');
        };
        document.getElementById('show-info-tab').onclick = () => {
            elements.userPanel.contents.info.classList.remove('hidden');
            elements.userPanel.contents.perms.classList.add('hidden');
        };
        document.getElementById('show-perms-tab').onclick = () => {
            elements.userPanel.contents.info.classList.add('hidden');
            elements.userPanel.contents.perms.classList.remove('hidden');
        };

        // Open/Close Panel
        elements.userPanel.button.onclick = () => elements.userPanel.view.classList.remove('hidden');
        elements.userPanel.closePanelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.authCancelBtn.onclick = () => elements.userPanel.view.classList.add('hidden');
        elements.userPanel.logoutBtn.onclick = () => { auth.signOut(); elements.userPanel.view.classList.add('hidden'); };

        // Editors
        elements.fabEdit.onclick = () => openEditor(state.currentArticle);
        elements.userPanel.addNewArticleBtn.onclick = () => openEditor(null);
        elements.editorForm.cancelButton.onclick = () => {
             elements.views.editor.classList.add('hidden');
             if(state.currentArticle) elements.views.article.classList.remove('hidden');
             else elements.views.main.classList.remove('hidden');
        };
        elements.editorForm.form.onsubmit = saveArticle;
        
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

        // Articles & Navigation
        elements.backButton.onclick = showMainView;
        document.body.addEventListener('click', e => {
            const card = e.target.closest('.article-card, .slide');
            if(card) displayArticle(card.dataset.id);
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
    }

    // Pozostałe funkcje (Comments, Slider) bez większych zmian, tylko skrócone dla czytelności tutaj...
    function listenForComments(id) {
        if(state.activeCommentsRef) state.activeCommentsRef.off();
        state.activeCommentsRef = database.ref(`comments/${id}`);
        state.activeCommentsRef.on('value', s => {
            const d = s.val() || {};
            elements.commentSection.list.innerHTML = Object.entries(d).map(([k,v]) => `
                <div class="comment" style="border-left: 3px solid ${v.userColor||'#fff'}">
                    <div class="comment-header"><span style="color:${v.userColor}">${v.author}</span></div>
                    <p>${v.message}</p>
                </div>`).join('');
        });
    }

    function init() {
        bindEvents();
        loadRolesConfig();
        auth.onAuthStateChanged(async u => {
            state.currentUser = null;
            if(u) {
                const s = await database.ref(`users/${u.uid}`).once('value');
                state.currentUser = { uid: u.uid, ...s.val() };
            }
            // Ważne: Nawet jeśli w bazie nie ma roli, UI pokaże "user", ale uprawnienia będą false
            if(state.currentUser) {
                elements.userPanel.nickSpan.textContent = state.currentUser.nick;
                elements.userPanel.userRoleBadge.textContent = state.currentUser.role || 'USER';
                elements.userPanel.infoView.classList.remove('hidden');
                elements.userPanel.authView.classList.add('hidden');
            } else {
                elements.userPanel.infoView.classList.add('hidden');
                elements.userPanel.authView.classList.remove('hidden');
            }
            calculatePermissions();
        });
        
        // Ładowanie artykułów
        database.ref('articles_meta').orderByChild('order').limitToFirst(ARTICLES_PER_PAGE).once('value', s => {
            const d = s.val();
            if(d) {
                state.allArticlesMeta = Object.values(d).sort((a,b)=>a.order-b.order);
                elements.newsList.innerHTML = state.allArticlesMeta.map(a => 
                    `<div class="article-card" data-id="${a.id}"><img src="${a.thumbnail}"><h4>${a.title}</h4></div>`
                ).join('');
            }
        });
    }

    init();
});
