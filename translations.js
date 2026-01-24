const resources = {
    pl: {
        translation: {
            nav: {
                title: "SEKSTAR NEWS"
            },
            home: {
                load_more: "Wczytaj więcej artykułów",
                featured_slider: "Wyróżnione"
            },
            article: {
                date_prefix: "",
                author_prefix: "Autor: ",
                loading: "Ładowanie treści...",
                like: "Polub",
                share: "Udostępnij",
                comments_title: "Komentarze",
                comment_placeholder: "Twoja wiadomość...",
                nick_placeholder: "Twój nick",
                add_comment: "Dodaj komentarz",
                load_more_comments: "Wczytaj więcej komentarzy",
                no_comments: "Brak komentarzy. Bądź pierwszy!",
                deleted_comment: "[Komentarz usunięty]",
                share_text: "Sprawdź ten artykuł na Sekstar News!",
                link_copied: "Link skopiowany do schowka!",
                share_api_error: "Twoja przeglądarka nie obsługuje udostępniania."
            },
            user_panel: {
                btn_info: "Informacje ogólne",
                btn_perms: "Uprawnienia",
                btn_login: "Logowanie",
                btn_register: "Rejestracja",
                welcome: "Witaj, ",
                label_nick: "Twój Nick:",
                label_color: "Twój Kolor Nicku:",
                label_color_desc: "(Widoczny w komentarzach)",
                label_email: "Twój Email:",
                label_rank: "Twoja Ranga:",
                btn_reset_pass: "Zresetuj hasło (otrzymasz email)",
                btn_save: "Zapisz zmiany",
                btn_logout: "Wyloguj",
                btn_close: "Zamknij",
                btn_cancel: "Anuluj",
                input_email: "Email",
                input_pass: "Hasło",
                btn_submit_login: "Zaloguj",
                btn_submit_reg: "Zarejestruj",
                add_new_article: "+ Utwórz Nowy Artykuł",
                loading_rank: "Wczytywanie..."
            },
            admin: {
                manage_users: "Zarządzanie Użytkownikami",
                assign_label: "Zmień rangę użytkownika (wpisz NICK):",
                assign_placeholder: "Wpisz dokładny nick użytkownika",
                btn_assign: "Nadaj Rangę",
                rank_editor: "Edytor Rang",
                rank_name_placeholder: "np. moderator",
                perm_write: "Pisanie/Edycja Artykułów",
                perm_delete: "Usuwanie Komentarzy",
                perm_manage: "Zarządzanie Rolami",
                btn_save_rank: "Zapisz/Aktualizuj Rangę"
            },
            editor: {
                title: "Edytor Artykułów",
                label_id: "ID:",
                label_order: "Order:",
                label_title: "Tytuł:",
                label_author: "Autor:",
                label_date: "Data:",
                label_thumb: "URL Miniaturki:",
                label_featured: "Wyróżniony na sliderze?",
                label_content: "Treść (HTML):",
                btn_save: "Zapisz",
                btn_cancel: "Anuluj",
                btn_delete: "USUŃ",
                confirm_delete: "Czy na pewno chcesz usunąć ten artykuł? Tej operacji nie można cofnąć.",
                save_success: "Artykuł zapisany pomyślnie!",
                delete_success: "Artykuł został usunięty.",
                error_permission: "Brak uprawnień!"
            },
            alerts: {
                nick_taken: "Ten nick jest zajęty!",
                saved: "Zapisano!",
                nick_registered: "Ten nick jest zarejestrowany. Zaloguj się!",
                confirm_delete_comment: "Usunąć ten komentarz?",
                rank_assigned: "Nadano rangę",
                user_not_found: "Nie znaleziono użytkownika o takim niku!",
                enter_nick: "Podaj nick!"
            }
        }
    },
    en: {
        translation: {
            nav: {
                title: "SEKSTAR NEWS"
            },
            home: {
                load_more: "Load more articles",
                featured_slider: "Featured"
            },
            article: {
                date_prefix: "",
                author_prefix: "Author: ",
                loading: "Loading content...",
                like: "Like",
                share: "Share",
                comments_title: "Comments",
                comment_placeholder: "Your message...",
                nick_placeholder: "Your nickname",
                add_comment: "Add comment",
                load_more_comments: "Load more comments",
                no_comments: "No comments yet. Be the first!",
                deleted_comment: "[Comment deleted]",
                share_text: "Check out this article on Sekstar News!",
                link_copied: "Link copied to clipboard!",
                share_api_error: "Your browser does not support sharing."
            },
            user_panel: {
                btn_info: "General Info",
                btn_perms: "Permissions",
                btn_login: "Login",
                btn_register: "Register",
                welcome: "Welcome, ",
                label_nick: "Your Nickname:",
                label_color: "Nickname Color:",
                label_color_desc: "(Visible in comments)",
                label_email: "Your Email:",
                label_rank: "Your Rank:",
                btn_reset_pass: "Reset password (email)",
                btn_save: "Save changes",
                btn_logout: "Logout",
                btn_close: "Close",
                btn_cancel: "Cancel",
                input_email: "Email",
                input_pass: "Password",
                btn_submit_login: "Login",
                btn_submit_reg: "Register",
                add_new_article: "+ Create New Article",
                loading_rank: "Loading..."
            },
            admin: {
                manage_users: "Manage Users",
                assign_label: "Change user rank (enter NICK):",
                assign_placeholder: "Enter exact user nickname",
                btn_assign: "Assign Rank",
                rank_editor: "Rank Editor",
                rank_name_placeholder: "e.g. moderator",
                perm_write: "Write/Edit Articles",
                perm_delete: "Delete Comments",
                perm_manage: "Manage Roles",
                btn_save_rank: "Save/Update Rank"
            },
            editor: {
                title: "Article Editor",
                label_id: "ID:",
                label_order: "Order:",
                label_title: "Title:",
                label_author: "Author:",
                label_date: "Date:",
                label_thumb: "Thumbnail URL:",
                label_featured: "Featured on slider?",
                label_content: "Content (HTML):",
                btn_save: "Save",
                btn_cancel: "Cancel",
                btn_delete: "DELETE",
                confirm_delete: "Are you sure you want to delete this article? This cannot be undone.",
                save_success: "Article saved successfully!",
                delete_success: "Article has been deleted.",
                error_permission: "Permission denied!"
            },
            alerts: {
                nick_taken: "This nickname is taken!",
                saved: "Saved!",
                nick_registered: "This nickname is registered. Please log in!",
                confirm_delete_comment: "Delete this comment?",
                rank_assigned: "Rank assigned",
                user_not_found: "User not found!",
                enter_nick: "Enter nickname!"
            }
        }
    }
};
