/**
 * routes.js
 * 
 * Fichier qui définit toutes les routes API JSON du serveur
 * Telles que décrites dans l'énoncé du sujet
 * - /messages (GET)
 * - /newmessages (GET)
 * - /signin (POST)
 * - /login (POST)
 * - /logout (POST)
 * - /user (GET)
 * - /post (POST)
 * - /like (POST)
 */

const express = require('express');

// Permet de créer des routes séparées
const router = express.Router();

// Fonctions qui accèdent à la base de données
const { createUser, getUser, addMessage, isLoginCorrect, getOlderMessages, getNewerMessages, toggleLikeMessage, createSession, deleteSession, getUserFromSession, getMessage } = require('../db');


/**
 * Récupère les messages avec pagination
 * 
 * @route GET /messages
 */
router.get('/messages', async (req, res) => {
    try{

        // Récupération des paramètres dans l'URL
        const datetime = new Date(parseInt(req.query.datetweet));
        const limit = parseInt(req.query.limit) || 5;
        // Appel à la base
        const messages = await getOlderMessages(datetime, limit);

        // Envoi en JSON
        return res.json({success: true, data: messages});
    } catch (err) {
        console.log(err);
        return res.json({success: false, error: "Internal server error."});
    }
    
});

/**
 * Retourne les messages plus récents qu'une date donnée.
 * Utilisé pour le polling des nouveaux messages côté client.
 *
 * @route GET /newmessages
 */
router.get('/newmessages', async (req, res) => {
    try{

        // Récupération des paramètres dans l'URL
        const datetime = new Date(parseInt(req.query.datetweet));

        // Appel à la base
        const messages = await getNewerMessages(datetime);

        // Envoi en JSON
        return res.json({success: true, data: messages});
    } catch (err) {
        console.log(err);
        return res.json({success: false, error: 'Internal server error.'});
    }
    
});

/**
 * Crée un nouvel utilisateur après validation des champs.
 *
 * @route POST /signin
 * 
 */
router.post('/signin', async (req, res) => {
    try {
        let { username, userid, password,} = req.body;
         
        if (!userid.trim()) {
            return res.json({success: false, error: "Login can't be empty."})  
        } else if (!/^[a-zA-Z0-9_.\-]+$/.test(userid)) {
            return res.json({success: false, error: "Invalid login (Only alphanumerical charcters, '.', '_' and '-' are allowed)."});   
        }else if (userid.length > 20) {
            return res.json({success: false, error: "Login is too long (maximum 20 characters)."});
        } else if (!/^[a-zA-Z0-9_.\- ]*$/.test(username)) {
            return res.json({success: false, error: "Invalid name (Only alphanumerical charcters, '.', '_', '-' and ' ' are allowed)."});
        } else if (username.trim().length > 20) {
            return res.json({success: false, error: "Name is too long (maximum 20 characters)."});
        } else if (!password) {
            return res.json({success: false, error: "Please enter a password."});
        } else if (password.length < 8) {
            return res.json({ success: false, error: "Password must be at least 8 characters long."})
        } else if (password.length > 64) {
            return res.json({success: false, error: "Password is too long (maximum 64 characters)"});
        } else {
            if (!username.trim()) {
                username = userid;
            }
            await createUser(userid.toLowerCase(), password, username.trim());
            return res.json({ success: true });
        }

    } catch (err) {
        if (err.code === '23505') {
            return res.json({ success: false, error: 'This user already exists.' });
        } else {
            console.log(err);
            return res.json({ success: false, error: 'Internal server error.' });
        }
    }
    
});

/**
 * Vérifie les identifiants utilisateurs
 * 
 * @route POST /login
 */
router.post('/login', async (req, res) => {

    try {
        const { username, password } = req.body;

        // on vérifie si l'utilisateur existe et si le mdp est correct
        if (await isLoginCorrect(username.toLowerCase(), password)) {
            return res.json({ success: true, sessionID: await createSession(username.toLowerCase()) });
        } else {
            return res.json({ success: false, error: "Invalid credentials (bad login or password)." });
        }
    } catch (err) {
        console.log(err);
        return res.json({ success: false, error: "Internal server error." });
    }

});

/**
 * Déconnecte un utilisateur en supprimant sa session côté serveur.
 *
 * @route POST /logout
 */
router.post('/logout', async (req, res) => {
    try {
        const { sessionID } = req.body;

        await deleteSession(sessionID);
        return res.json({success: true});
    } catch (err) {
        console.log(err);
        return res.json({ success: false, error: "Internal server error." });
    }

});

/**
 * Récupère l'utilisateur associé à une session.
 * 
 * @route GET /user
 */
router.get('/user', async (req, res) => {
    try {
        const sessionID = req.headers.authorization;
        const user = await getUserFromSession(sessionID);
        if (user) {
            return res.json({success: true, username: user.id});
        } else {
            return res.json({ success: false, invalid_session: true, error: "Your session has expired, please log back in." });
        }
        
    } catch (err) {
        console.log(err);
        return res.json({ success: false, error: "Internal server error." });
    }
});

/**
 * Publie un message après vérification utilisateur
 * 
 * @route POST /post 
 */
router.post('/post', async (req, res) => {
    try {
        const { sessionID, content } = req.body;

        // Vérifie la session
        const user = await getUserFromSession(sessionID);
        if (!user) {
            return res.json({ success: false, invalid_session: true, error: "Your session has expired, please log back in." });
        }
        
        // Ajout du message
        if (!content.trim()) {
            return res.json({ success: false, error: "A Twyt can't be empty." });
        } else if (content.length > 560) {
            return res.json({ success: false, error: "A Twyt can't be longer than 560 characters." });
        } else {
            // envoie le message en trimant le contenu (2 saut de lignes d'affilés max)
            await addMessage(user.id, content.trim().replace(/\n{3,}/g, '\n\n'));
        }

        return res.json({ success: true });
    }  catch (err) {
        console.log(err);
        return res.json({ success: false , error: "Internal server error."});
    }

});

 /**
  * Ajoute ou retire un like sur un message (toggle).
  * Récupère le nouveau nombre de likes du message
  *
  * @route POST /like
  */
router.post("/like", async (req, res) => {
    try {
        const { sessionID, messageid } = req.body;
        
        

        // Vérifie la session
        const user = await getUserFromSession(sessionID);
        if (!user) {
            return res.json({success: false, invalid_session: true, error: "Your session has expired, please log back in."});
        }

        // vérifie que le message existe
        if (!await getMessage(messageid)) {
            return res.json({success: false, error: "This Twyt doesn't exist."});
        }

        // récupère le nouveau nombre de likes du message
        const likeCount = await toggleLikeMessage(user.id, messageid);

        return res.json({ success: true, likeCount: likeCount});

    } catch (err) {
        console.error(err);
        return res.json({success: false, error: 'Internal server error.'});
    }
});

module.exports = router;