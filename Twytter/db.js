/**
 * db.js
 * 
 * fichier qui se charge de la connexion à la base de données
 * et des requêtes associées.
 */

//Charge les variables d’environnement depuis le fichier .env
require('dotenv').config();

// Librairie pour créer des hashes de mot de passes
const argon2 = require("argon2");

/**
 * Retourne le hash d'un mot de passe avec argon2id.
 * 
 * @param {string} password 
 * 
 * @returns {Promise<string>} Hash du mot de passe
 */
async function hashPassword(password) {
    try {
        const hash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 12288,
            timeCost: 2,
            parallelism: 1
        });
        return hash;
    } catch (err) {
        console.log("Hashing error :", err);
        throw err;
    }
}

// ORM query builder Knex configuré pour PostgreSQL
const knex = require('knex')({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    },
    pool: {
    min: 0,
    max: 2,
    acquireTimeoutMillis: 10000,
    idleTimeoutMillis: 10000
    }
});

/**
 * Récupère un utilisateur par son ID
 * 
 * @param {string} id 

 * @returns {Promise<Object|null>}}
 */
async function getUser(id) {
    return await knex("users").where({ id }).first();
}

/**
 * Crée un nouvel utilisateur en base (mot de passe hashé automatiquement avant insertion)
 * @param {string} login 
 * @param {string} pass 
 * @param {string} username 
 */
async function createUser(login, pass, username) {
    await knex.raw('INSERT INTO users (id, hash, username) VALUES (?, ?, ?);',
        [login, await hashPassword(pass), username]
    );
}

/**
 * Vérifie si les informations de connexions sont valides
 * 
 * @param {string} id 
 * @param {string} pass 
 * 
 * @returns {Promise<boolean>}
 */
async function isLoginCorrect(id, pass) {
    const user = await getUser(id);
    if (!user) return false;
    return await argon2.verify(user.hash, pass); // compare les hashes
}

/**
 * Ajoute un message en base
 * 
 * @param {string} userid 
 * @param {string} content 
 */
async function addMessage(userid, content) {
    await knex.raw('INSERT INTO messages (userid, content) VALUES (?, ?);',
        [userid, content]
    );
}

/**
 * Récupère le nombre de likes d’un message depuis son id
 * 
 * @param {string} id 
 * 
 * @returns {Promise<number>}
 */
async function getMessageLikeCount(id) {
    const result = await knex.raw(
        `SELECT COUNT(likes.id) AS like_count
        FROM messages
        LEFT JOIN likes ON likes.messageid = messages.id
        WHERE messages.id = ?
        GROUP BY messages.id
        `,
        [id]
    );
    return result.rows[0].like_count;
}

/**
 * Récupère les messages plus anciens qu'une date donnée
 * 
 * @param {Date|string} timestamp
 * @param {number} limit Nombre de messages max à récupérer.
 * 
 * @returns {Promise<Array>} Liste des messages (objets)
 */
async function getOlderMessages(timestamp=new Date(), limit=5) {
    const ts = new Date(timestamp).toISOString(); // récupère la date sous le bon format pour SQL
    const result = await knex.raw(
        `SELECT messages.*, users.username, COUNT(likes.id) AS like_count
         FROM messages 
         JOIN users ON users.id = messages.userid
         LEFT JOIN likes ON likes.messageid = messages.id
         WHERE messages.datetime < ?
         GROUP BY messages.id, users.username
         ORDER BY messages.datetime
         DESC 
         LIMIT ?`,
        [ts, limit]
    );
    return result.rows;
}

/**
 * Récupère les messages plus récents qu'une date donnée
 *
 * @param {Date|string} timestamp
 * 
 * @returns {Promise<Array>} Liste des messages (objets)
 */
async function getNewerMessages(timestamp=new Date()) {
    const ts = new Date(timestamp).toISOString(); // récupère la date sous le bon format pour SQL
    const result = await knex.raw(
        `SELECT messages.*, users.username, COUNT(likes.id) AS like_count
         FROM messages 
         JOIN users ON users.id = messages.userid
         LEFT JOIN likes ON likes.messageid = messages.id
         WHERE messages.datetime > ?
         GROUP BY messages.id, users.username
         ORDER BY messages.datetime
         ASC`,
        [ts]
    );
    return result.rows;
}

/**
 * Récupère un message par son ID
 *
 * @param {number|string} messageid
 * 
 * @returns {Promise<Object|null>}
 */
async function getMessage(messageid) {
    return await knex('messages')
        .where({ id: messageid })
        .first();
}

/**
 * Toggle like/unlike d’un message pour un utilisateur
 *
 * @param {string} userid
 * @param {number|string} messageid
 * 
 * @returns {Promise<number>} Nouveau nombre de likes
 */
async function toggleLikeMessage(userid, messageid) {
    const exists = await knex('likes')
        .where({userid, messageid})
        .first();
    
    if (exists) {
        await knex('likes').where({userid, messageid}).delete();
    } else {
        await knex('likes').insert({userid, messageid});
    }
    return await getMessageLikeCount(messageid);
}

/**
 * Crée une session utilisateur et retourne sa sessionID
 *
 * @param {string} login
 * 
 * @returns {Promise<string|number>}
 */
async function createSession(login) {
    const [session] = await knex('sessions').insert({ userid: login }).returning('id');
    return session.id;
}

/**
 * Supprime une session
 *
 * @param {string} sessionID
 */
async function deleteSession(sessionID) {
    await knex('sessions').where({ id: sessionID }).delete();
}

/**
 * Récupère l'utilisateur associé à une session valide
 * Supprime la session si elle est expirée
 *
 * @param {string} sessionID
 * @returns {Promise<Object|null>}
 */
async function getUserFromSession(sessionID) {
    const result = await knex.raw(
        `SELECT users.*
        FROM users
        JOIN sessions ON sessions.userid = users.id
        WHERE sessions.id = ?
        AND sessions.expiration > NOW()`,
        [sessionID]
    );

    if (!result.rows[0]) {
        deleteSession(sessionID);
        return null;
    } else {
        return result.rows[0];
    }
}


// Export des fonctions pour les utiliser ailleurs
module.exports = { 
    createUser,
    getUser,
    isLoginCorrect,
    addMessage,
    getOlderMessages,
    getNewerMessages,
    toggleLikeMessage,
    createSession,
    deleteSession,
    getUserFromSession,
    getMessage
};