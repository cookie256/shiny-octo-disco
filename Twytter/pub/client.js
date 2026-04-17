/**
 * client.js
 * 
 * Fichier qui gère toute l'interface côté client.
 * Affiche les messages, peremet la connexion, deconnexion et l'inscription
 * Gestion du scroll infini et des post de message
 */



// ======================
// ETAT GLOBAL
// ======================

// Nombre de messages chargés par requête
const limit = 10;

// Empêche les chargements multiples simultanés
let loading = false;

// Indique si tous les messages ont été chargés 
let allLoaded = false;

// Vue actuellement affichée dans l'application
let currentView = 'messages';

// Date du message le plus ancien actuellement chargé dans le feed
let oldestDatetime = new Date();

// Date du message le plus récent actuellement chargé
let newestDatetime = new Date();

// Indique si une requête de vérification des nouveaux messages est déjà en cours
let isCheckingForNewMessages = false;

// Si l'utilisateur est connecté à un compte ou non
let isLoggedIn = false;



// ======================
// NOTIFICATIONS
// ======================

/**
 * Fonction pour afficher des notifications temporaires
 * 
 * @param {string} text - message a afficher
 * @param {string} color - couleur du message (par défaut blanc)
 * 
 */
function showNotification(text, color='white') {
    const notifZone = document.getElementById("notifZone");
    const notif = document.createElement('div');
    notif.textContent = text;
    notif.className = "notification";
    notif.style.color = color;
    notifZone.appendChild(notif);

    // temps avant disparition, fondu
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => {
            notif.remove();
        }, 500);
    }, 3000);
}



// ======================
// AUTHENTICATION
// ======================

/**
  * Crée un compte utilisateur puis tente de le connecter automatiquement si la création réussit.
  *
  * @returns {Promise<void>}
 */
async function signup() {
    // récupération des inputs
    const username = document.getElementById('su_name').value;
    const userid = document .getElementById('su_user').value;
    const password = document.getElementById('su_pass').value;
    const confirm = document.getElementById('su_pass_confirm').value;

    // vérification si les mdp matchent
    if (password !== confirm) {
        showNotification("Passwords doesn't match.", "red");
        return;
    }

    const res = await fetch('/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid, username, password })
    });

    const data = await res.json();

    if (data.success) {
        showNotification("Account created!");
        await login(userid, password); // auto log in
    } else {
        showNotification(data.error || 'There was an error, please try again.', 'red');
    }
}

/**
 * 
 * Authentifie un utilisateur auprès du serveur et initialise la session côté client.
 * Stocke le sessionID renvoyé par le serveur.
 * 
 * @param {string} username 
 * @param {string} password 
 * 
 * @returns {Promise<void>}
 */
async function login(username, password) {
    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
        localStorage.setItem('username', username.toLowerCase());
        localStorage.setItem('sessionID', data.sessionID);
        showNotification('Logged in successfuly.');
        await updateUI();
        goToMainPage();
    } else {
        showNotification(data.error || 'There was an error, please try again.', 'red');
    }
}

/**
 * Déconnecte l'utilisateur en envoyant une requête au serveur,
 * puis nettoie le localStorage et met à jour l'interface.
 * 
 * @returns {Promise<void>}
 */
async function logout() {
    if (localStorage.getItem('sessionID')) {
        const res = await fetch('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionID: localStorage.getItem("sessionID")
        })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Logged out successfully.');
        } else {
            showNotification(data.error || 'There was an error, please try again.', 'red');
        }
    }
    isLoggedIn = false;
    localStorage.clear(); // supprime toutes les données stockées
    await updateUI(); // met à jour les boutons visibles 
    goToMainPage(); // retourne à la liste des messages
    
}

// ======================
// POST MESSAGE
// ======================

/**
  * Envoie un message au serveur si l'utilisateur est connecté.
  * Réinitialise le champ de saisie en cas de succès et rafraîchit les nouveaux messages.
  *
  * @returns {Promise<void>}
 */
async function sendMsg() {
    if (!isLoggedIn) {
        showNotification('You must be logged in to Twyt!');
        return;
    }
    const content = document.getElementById('msg').value;

    // Récupère la sessionID
    const sessionID = localStorage.getItem('sessionID');

    // Requête POST vers le serveur
    const res = await fetch('/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        // Données envoyées au serveur
        body: JSON.stringify({ sessionID: sessionID, content: content })
    });

    const data = await res.json();

    // Si succès, on cache la fenetre d'envoi et lance un check pour afficher le nouveau message
    if (data.success) {
        document.getElementById('msg').value = '';
        document.getElementById('ctr').textContent = 0;
        modal.classList.add('hidden');
        await checkNewMessages();
        showNotification('Twyt sent!');
    } else {
        if (data.invalid_session) { // déconnecte user
            sessionStorage.clear();
            showNotification(data.error || 'There was an error, please try again.', 'red');
            logout();
        } else { // erreur
            showNotification(data.error || 'There was an error, please try again.', 'red');
        }
    }
}



// ======================
// UI / MENU
// ======================

/**
 * Met à jour l'interface utilisateur en fonction de l'état de connexion.
 * Vérifie la validité de la session auprès du serveur si un sessionID est présent.
 * Ajuste les éléments visibles (login, signup, logout, etc.) et réinitialise certains champs.
 *
 * @returns {Promise<void>}
 */
async function updateUI() {
    if (localStorage.getItem('sessionID')) { //on vérifie si une session est stockée côté client
        const res = await fetch('/user', { // vérifie que la sessionID est valide
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': localStorage.getItem("sessionID")
        }});
        const data = await res.json();
        if (data.success) { // valide, connecté
            isLoggedIn = true;
        } else { // invalide, non connecté
            isLoggedIn = false;
            localStorage.clear();
            showNotification(data.error || 'There was an error, please try again.', 'red');
        }
    } else { // non connecté
        isLoggedIn = false;
        localStorage.clear();
    }

    // reset la boite de message et la cache
    document.getElementById('msg').value = '';
    document.getElementById('ctr').textContent = 0;
    modal.classList.add('hidden');

    // Si l'utilisateur est connecté, on cache les options login/signup
    document.getElementById('loginBtn').classList.toggle('hidden', isLoggedIn);
    document.getElementById('signupBtn').classList.toggle('hidden', isLoggedIn);

    // Si l'utilisateur est connecté, on affiche twyt/logout et son nom d'utilisateur
    document.getElementById('openTwytBtn').classList.toggle('hidden', !isLoggedIn);
    document.getElementById('logoutBtn').classList.toggle('hidden', !isLoggedIn);
    document.getElementById('loginStatus').innerText = isLoggedIn ? 'Hello @' + (localStorage.getItem('username') || 'please don\'t delete your local storage :\'(') : ''
}


/**
 * Initialise la vue des messages
 * Restaure la pagination, vide le DOM et recharge les messages
 */
function goToMainPage() {
    currentView = 'messages';
    allLoaded = false;
    newestDatetime = new Date();
    oldestDatetime = new Date();

    const app = document.getElementById('app');
    app.innerHTML = ''; // efface tout

    loadMessages(); // recharge les messages
}



// ======================
// RENDER MESSAGES
// ======================

/**
 * Crée et retourne un élément HTML représentant un message.
 * Inclut les informations utilisateur, le contenu, la date et la gestion des likes.
 *
 * @param {Object} msg - Objet qui contient le contenu du message.
 * 
 * @returns {HTMLDivElement} Élément DOM représentant le message.
 */
function createHTMLMessage(msg) {

    // conteneur global du message
    const divMsg = document.createElement('div');
    const divEntete = document.createElement('div');
    divEntete.className = 'entete-msg';

    // nom affiché (utilisateur qui poste le message)
    const username = document.createElement('span');
    username.className = 'username';
    username.textContent = msg.username;

    // pseudo affiché
    const userid = document.createElement('span');
    userid.className = 'userid';
    userid.textContent = '@' + msg.userid;

    // Date du message
    const msgDate = document.createElement('span');
    msgDate.className = 'date'
    msgDate.textContent = new Date(msg.datetime)
        .toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
    );
    divEntete.appendChild(username);
    divEntete.appendChild(userid);
    divEntete.appendChild(msgDate);

    // conteneur du message (texte)
    const div = document.createElement('div');
    div.className = 'message';
    const p = document.createElement('p');
    p.textContent = msg.content;
    div.appendChild(p);

    // affichage du bouton de like et du compteur de likes
    const likeCount = document.createElement("span");
    const likeEmoji = document.createElement("span");
    likeEmoji.textContent = "💙";
    likeCount.appendChild(likeEmoji);
    const likeNumber = document.createElement("span");
    likeNumber.textContent =  Number(msg.like_count) !== 0 ? Number(msg.like_count) : '';
    likeNumber.id = msg.id;
    likeCount.appendChild(likeNumber);
    likeCount.style.marginLeft = "5px";
    likeCount.style.fontWeight = "bold";
    likeCount.className = "like";

    // Gestion des likes avec une fonction écoutant l'évènement onclick du bouton
    likeCount.onclick = async () => {
        if (isLoggedIn) {
            const likeNumber = document.getElementById(msg.id);
            const response = await fetch("/like", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionID: localStorage.getItem("sessionID"),
                    messageid: msg.id
                })
            });
            const data = await response.json();
            if (data.success) {
                likeNumber.innerText = Number(data.likeCount) !== 0 ? Number(data.likeCount) : '';
            } else {
                if (data.invalid_session) {
                    isLoggedIn = false;
                    localStorage.clear();
                    logout();
                }
                showNotification(data.error || 'There was an error, please try again.', 'red');
            }  
        } else {
            showNotification('You must be logged in to like a message!');
        }
    };

    divMsg.appendChild(divEntete);
    divMsg.appendChild(div);
    divMsg.appendChild(likeCount);
    return divMsg;
}


/**
 * Charge et affiche les messages depuis le serveur avec pagination.
 * Empêche les appels concurrents et arrête le chargement lorsque tous les messages sont récupérés.
 * Continue de charger automatiquement tant que la page n'est pas scrollable.
 * 
 * @returns {Promise<void>}
 */
async function loadMessages() {
    // Protection contre appels inutiles
    if (loading || allLoaded || currentView !== 'messages') return;

    loading = true; // Bloque les autres appels
    
    do {
        // Appel de l'API avec pagination
        const res = await fetch(`/messages?datetweet=${new Date(oldestDatetime).getTime()}&limit=${limit}`);
        const response = await res.json();
        if (!response.success) {
            showNotification(response.error || 'There was an error while fetching messages, please try again.', 'red');
            return;
        }

        const messages = response.data;
        
        const app = document.getElementById('app');

        // Si il ne reste plus de message, fin du chargement
        if (messages.length === 0) {
            allLoaded = true;
            loading = false;
            const div = document.createElement('div');
            const p = document.createElement('p');
            div.className = 'endScroll';
            p.textContent = 'End of messages';
            div.appendChild(p);
            app.appendChild(div);
            return;
        }

        // Ajoute une seconde vérification pour être sûr que l'utilisateur n'a pas changé de page entre-temps
        if (currentView !== 'messages') {
            loading = false;
            return;
        }

        // Ajout des messages dans le DOM
        messages.forEach(msg => {
            app.appendChild(createHTMLMessage(msg));
        });

        // Mise à jour de la date du tweet le plus ancien affiché
        oldestDatetime = new Date(messages[messages.length -1].datetime);

    } while (loading && document.documentElement.scrollHeight <= window.innerHeight); // tant qu'il reste des messages à afficher et que la page affichée n'est pas remplie

    loading = false;
}

/**
 * Vérifie et charge les nouveaux messages depuis le serveur.
 * Ajoute les messages récents en haut de la liste si disponibles.
 * Empêche les appels concurrents et s'exécute uniquement sur la vue "messages".
 * 
 * @returns {Promise<void>}
 */
async function checkNewMessages() {
    if (isCheckingForNewMessages || loading || currentView !== 'messages') return;
    isCheckingForNewMessages = true;

    // récupère les messages plus récents que ceux déjà chargés
    const res = await fetch(`/newmessages?datetweet=${new Date(newestDatetime).getTime()+1}`);
    const response = await res.json();

    if (!response.success) {
        showNotification(response.error || 'There was an error while fetching new messages, please try again.', 'red');
        return;
    }

    const messages = response.data;
        
    // si il y a des nouveaux messages
    if (messages.length !== 0 && currentView === 'messages') {
        // update la variable globale stockant la date du message le plus récent
        newestDatetime = new Date(messages[messages.length -1].datetime);
        const app = document.getElementById('app');
        messages.forEach(msg => {
            app.prepend(createHTMLMessage(msg));
            
        });
    }
    isCheckingForNewMessages = false;

}



// ======================
// FORMS
// ======================

/**
 * Affiche le formulaire de création de compte
 */
function showSignupForm() {
    currentView = 'signup';

    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="form">
        <form>
        <h3>Create an account</h3>
        <input id="su_name" placeholder="Name" type="text" maxlength="20"><br><br>
        <input id="su_user" placeholder="Login" type="text" maxlength="20 required"><span style="color:red"> *</span></label><br><br>
        <input id="su_pass" type="password" placeholder="Password" maxlength="64"><span style="color:red" required> *</span></label><br><br>
        <input id="su_pass_confirm" type="password" placeholder="Confirm Password" maxlength="64"><span style="color:red" required> *</span></label><br><br>
        <button type="button" id="signup-btn">Sign Up</button>
        <button type="button" id="cancel-btn">Cancel</button>
        </form>
        </div>
    `;

    document.getElementById('signup-btn').addEventListener('click', signup);
    document.getElementById('cancel-btn').addEventListener('click', goToMainPage);
}

/**
  * Affiche le formulaire de connexion et initialise les événements associés.
  * Met à jour la vue courante vers "login".
 */
function showLoginForm() {
    currentView = 'login';

    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="form">
        <form>
        <h3>Log into your account</h3>
        <input id="li_user" placeholder="Login" type="text" maxlength="20"><span style="color:red"> *</span></label><br><br>
        <input id="li_pass" type="password" placeholder="Password" maxlength="64"><span style="color:red"> *</span></label><br><br>
        <button type="button" id="login-btn">Log In</button>
        <button type="button" id="cancel-btn">Cancel</button>
        </form>
        </div>
        `;

    document.getElementById('login-btn').addEventListener('click', loginButton);
    document.getElementById('cancel-btn').addEventListener('click', goToMainPage);
}

/**
 * Envoie les identifiants au serveur
 * mise à jour de l'UI et retour aux messages
 */
async function loginButton() {
    const username = document.getElementById('li_user').value;
    const password = document.getElementById('li_pass').value;

    await login(username, password);
}



// ======================
// SCROLL EVENT
// ======================

/**
 * Détecte le scroll de la page et déclenche le chargement de messages
 * lorsque l'utilisateur approche du bas de la liste (infinite scroll).
 */
window.onscroll = () => {

    // Scroll seulement sur la page des messages
    if (currentView !== 'messages') return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const fullHeight = document.body.offsetHeight;

    // Lorsqu'on est proche du bas, on charge plus de messages
    if (scrollTop + windowHeight >= fullHeight - 350) {
        loadMessages();
    }
};



// ======================
// PAGE INITIALIZATION
// ======================

/**
 * Initialise l'application au chargement de la page :
 * - attache les événements UI
 * - initialise l'état utilisateur
 * - charge les messages
 */
window.onload = async () => {

    // creation de la zone pour les notifications
    const notifZone = document.createElement('div');
    notifZone.className = "notifZone";
    notifZone.id = "notifZone";
    document.body.appendChild(notifZone);

    // Associe les boutons aux fonctions 
    document.getElementById('logo').addEventListener('click', () => {
        goToMainPage();
    })
    document.getElementById('loginBtn').onclick = showLoginForm;
    document.getElementById('signupBtn').onclick = showSignupForm;
    document.getElementById('logoutBtn').onclick = logout;

    await updateUI();
    goToMainPage();

    const modal = document.getElementById('modal');

    // Gestionnaire d'évènement pour ouvrir la page modale d'envoi de Twyt
    document.getElementById('openTwytBtn').onclick = () => modal.classList.remove('hidden');

    // Pour fermer la fenetre modale via bouton
    document.getElementById('cancel-msg').onclick = () => {
        document.getElementById('msg').value = '';
        document.getElementById('ctr').textContent = 0;
        modal.classList.add('hidden');
    };

    // Pour fermer la fenetre modale via un click en dehors
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.getElementById('msg').value = '';
            document.getElementById('ctr').textContent = 0;
            modal.classList.add('hidden');
        }
    };

    const textarea = document.getElementById("msg");
    textarea.addEventListener("input", () => { // update le compteur de lettres pour un twyt
        document.getElementById("ctr").textContent = textarea.value.length;
    });
    document.getElementById("send-msg").addEventListener("click", sendMsg);

    // check toutes les 5 secondes si il y a un nouveau message à afficher
    setInterval(() => {
        checkNewMessages();
    }, 5000);
};