document.addEventListener('DOMContentLoaded', () => {
    // === 1. KONFIGURACJA FIREBASE (tylko do odczytu i logowania) ===
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
    
    // ... reszta kodu (logika UI, wyświetlanie) pozostaje w większości bez zmian ...

    // === NOWE FUNKCJE ZAPISU DANYCH ===
    async function apiRequest(action, id, body) {
        const response = await fetch(`/api/${action}/${id}`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        return response.ok;
    }

    // === PRZEROBIONA LOGIKA INTERAKCJI ===
    function updateLikeButton(likes, articleId) {
        const likeButton = document.getElementById('like-button');
        const likeCountSpan = document.getElementById('like-count');
        likeCountSpan.textContent = likes;
        const alreadyLiked = localStorage.getItem(`liked_${articleId}`) === 'true';
        // ... reszta logiki zmiany wyglądu ...

        likeButton.onclick = async () => {
            const increment = alreadyLiked ? -1 : 1;
            const success = await apiRequest('likes', articleId, { increment });
            if (success) {
                localStorage.setItem(`liked_${articleId}`, !alreadyLiked);
            }
        };
    }

    function addComment(author, message) {
        apiRequest('comments', currentArticle.id, { author, message });
    }

    // ... cała reszta Twojego kodu ...
    // Pamiętaj, aby usunąć stare funkcje zapisu, które używały `database.ref(...).set()`
    // i zastąpić je nowymi wywołaniami.
});
