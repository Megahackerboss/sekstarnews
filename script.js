document.addEventListener('DOMContentLoaded', () => {
    // === KONFIGURACJA BASEROW (Wklej tutaj swoje dane z Kroku 4) ===
    const baserowConfig = {
        apiToken: "YOUR_DATABASE_TOKEN", // <-- WKLEJ SWÓJ DATABASE TOKEN
        articlesTableId: "YOUR_ARTICLES_TABLE_ID", // <-- WKLEJ ID TABELI Articles
        commentsTableId: "YOUR_COMMENTS_TABLE_ID"  // <-- WKLEJ ID TABELI Comments
    };
    const baserowApiUrl = "https://api.baserow.io/api/database/rows/table/";

    // === ELEMENTY DOM (bez zmian) ===
    const backButton = document.getElementById('back-button');
    const mainView = document.getElementById('main-view');
    // ... i tak dalej, reszta elementów DOM ...
    const articleContent = document.getElementById('article-content');
    const likeButton = document.getElementById('like-button');
    const likeCountSpan = document.getElementById('like-count');
    const commentForm = document.getElementById('comment-form');
    const commentsList = document.getElementById('comments-list');
    
    let allArticles = [];
    let currentArticle = null;

    // --- GŁÓWNA LOGIKA APLIKACJI ---

    // 1. Ładujemy lokalną konfigurację artykułów (nadal z articles.json)
    async function loadArticlesConfig() {
        try {
            const response = await fetch('articles/articles.json');
            allArticles = await response.json();
            // Reszta logiki do budowy slidera i listy zostaje bez zmian
        } catch (error) { console.error("Błąd ładowania articles.json:", error); }
    }

    // 2. Otwieranie artykułu i pobieranie DYNAMICZNYCH danych z Baserow
    async function displayArticle(articleId) {
        currentArticle = allArticles.find(a => a.id == articleId);
        if (!currentArticle) return;

        // Wypełniamy statyczną treść
        articleContent.innerHTML = currentArticle.content;
        // ... wypełnij datę, autora itp. ...

        // Przełączamy widoki
        mainView.classList.add('hidden');
        articleView.classList.remove('hidden');
        
        // POBIERAMY DANE Z BASEROW
        try {
            // Używamy Promise.all, aby pobrać polubienia i komentarze jednocześnie
            const [likesData, commentsData] = await Promise.all([
                getLikes(articleId),
                getComments(articleId)
            ]);
            updateLikeButton(likesData.likes, likesData.row_id); // Przekazujemy row_id do aktualizacji
            loadComments(commentsData);

        } catch (error) {
            console.error("Błąd pobierania danych z Baserow:", error);
            // Wyświetl użytkownikowi informację o błędzie
            likeCountSpan.textContent = 'Błąd';
            commentsList.innerHTML = '<p>Nie udało się załadować komentarzy.</p>';
        }
    }

    // --- FUNKCJE KOMUNIKACJI Z BASEROW ---

    // Pobierz polubienia dla danego artykułu
    async function getLikes(articleId) {
        const url = `${baserowApiUrl}${baserowConfig.articlesTableId}/?user_field_names=true&filter__article_id__equal=${articleId}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${baserowConfig.apiToken}` }
        });
        const data = await response.json();
        const articleData = data.results[0];
        return {
            likes: articleData ? articleData.likes : 0,
            row_id: articleData ? articleData.id : null // Baserow używa "id" jako identyfikatora wiersza
        };
    }

    // Pobierz komentarze dla danego artykułu
    async function getComments(articleId) {
        const url = `${baserowApiUrl}${baserowConfig.commentsTableId}/?user_field_names=true&filter__article_id__equal=${articleId}&order_by=-id`; // Sortuj od najnowszych
        const response = await fetch(url, {
            headers: { 'Authorization': `Token ${baserowConfig.apiToken}` }
        });
        const data = await response.json();
        return data.results;
    }

    // Dodaj polubienie (aktualizuj wiersz w Baserow)
    async function addLike(currentLikes, rowId) {
        if (!rowId) {
            console.error("Nie można polubić artykułu, który nie istnieje w bazie Baserow!");
            return currentLikes; // Zwróć starą wartość
        }
        const url = `${baserowApiUrl}${baserowConfig.articlesTableId}/${rowId}/?user_field_names=true`;
        const newLikes = currentLikes + 1;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Token ${baserowConfig.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "likes": newLikes })
        });
        const data = await response.json();
        return data.likes;
    }

    // Dodaj komentarz (stwórz nowy wiersz w Baserow)
    async function addComment(author, message) {
        const url = `${baserowApiUrl}${baserowConfig.commentsTableId}/?user_field_names=true`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${baserowConfig.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "article_id": currentArticle.id,
                "author": author,
                "message": message
            })
        });
        return response.ok; // Zwróć true, jeśli się udało
    }

    // --- AKTUALIZACJA INTERFEJSU ---

    function updateLikeButton(likes, rowId) {
        likeCountSpan.textContent = likes;
        likeButton.onclick = async () => {
            likeButton.disabled = true; // Zapobiegaj wielokrotnemu klikaniu
            const newLikes = await addLike(likes, rowId);
            updateLikeButton(newLikes, rowId);
            likeButton.disabled = false;
        };
    }
    
    function loadComments(comments) {
        commentsList.innerHTML = '';
        if (comments.length === 0) {
            commentsList.innerHTML = '<p>Brak komentarzy. Bądź pierwszy!</p>';
            return;
        }
        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';
            commentEl.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.author}</span>
                    <span class="comment-date">${new Date(comment['Created on']).toLocaleString()}</span>
                </div>
                <p class="comment-message">${comment.message}</p>
            `;
            commentsList.appendChild(commentEl);
        });
    }

    commentForm.onsubmit = async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('comment-name');
        const messageInput = document.getElementById('comment-message');
        
        const success = await addComment(nameInput.value, messageInput.value);
        if (success) {
            commentForm.reset();
            // Odśwież tylko komentarze, bez przeładowywania całego artykułu
            const commentsData = await getComments(currentArticle.id);
            loadComments(commentsData);
        } else {
            alert("Nie udało się dodać komentarza.");
        }
    };
    
    // --- Inicjalizacja i reszta kodu (bez większych zmian) ---
    // Wklej tutaj resztę swojego kodu JavaScript, który odpowiada za slider,
    // przełączanie widoków, przycisk wstecz itp.
    // Upewnij się, że kliknięcie na artykuł wywołuje nową funkcję `displayArticle(id)`.

});
