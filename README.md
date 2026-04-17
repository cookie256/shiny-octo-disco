# Twytter

### Description du projet

#### Fonctionnalités
Cette application permet à un utilisateur (connecté ou non) de consulter des messages postés par d'autres utilisateurs dans une même fenêtre. Un utilisateur connecté peut choisir de se déconnecter ou poster et liker des messages. L'application propose plusieurs vues :
* Une vue pour consulter les messages.
* Une vue pour créer un compte.
* Une vue pour se connecter.
* Une vue pour rédiger un message (dans une fenêtre modale).

#### Les modules supplémentaires implémentés
* L'utilisation de sessions pour gérer l'authentification (stockage du sessionId dans localStorage).
* Le chargement dynamique de messages lorsque l'utilisateur fait défiler la page.
* L'actualisation des nouveaux messages toutes les 5 secondes.
* La configuration de HTTPS sur le serveur Node.js.

### Prérequis
#### Essentiels
* Navigateur Chromium ou Firefox
* Node v24+
* Une base de données PostgreSQL (possibilité d'utiliser le service en ligne gratuit [Neon](https://neon.com/)).
* `DATABASE_URL` correctement renseigné dans `Twytter/.env`

#### Pour obtenir un certificat valide et utiliser HTTPS (testé sur linux uniquement, peut varier selon votre OS)
* [libnss3-tools](https://firefox-source-docs.mozilla.org/security/nss/build.html#mozilla-projects-nss-building) `[apt/brew/...] install libnss3-tools` (optionnel, permet de ne plus avoir d'avertissement lors du chargement de la page)
* [mkcert](https://github.com/FiloSottile/mkcert) `[apt/brew/...] install mkcert`
* Certificats `localhost-key.pem` et `localhost.pem` (pour HTTPS via node), placés dans `Twytter/` 
    * Redémarrez votre navigateur si vous rencontrez des problèmes avec HTTPS

### Pour lancer l'application en local
* `make install` Pour installer les modules et créer les tables dans la BDD(nécessaire lors du premier lancement).
* `make certs` Pour générer les certificats (optionnel, permet d'utiliser https).
* `make start` Pour lancer l'application.
* `make` Pour exécuter à la suite toutes les commandes ci-dessus.
* Naviguez vers :
    * HTTP : http://localhost:3000
    * HTTPS : https://localhost:8443