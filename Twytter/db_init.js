/**
 * db_init.js
 * 
 * fichier qui gère la création des tables.
 */

// Charge les variables d’environnement (.env)
require('dotenv').config();

// Initialisation de Knex (client PostgreSQL)
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
 * Initialise la base de données :
 * - crée l'extension pgcrypto pour générer des longs nombres sécurisés pour les sessionIDs
 * - crée les tables si elles n'existent pas
 */
async function create_tables() {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    if (!await knex.schema.hasTable('users')) {
        await knex.schema.createTable('users', (table) => {
            table.string('id', 20).primary();
            table.text('hash').notNullable();
            table.string('username', 20);
        });
    }
    if (!await knex.schema.hasTable('messages')) {
        await knex.schema.createTable('messages', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw("gen_random_uuid()"));
            table.string('userid', 20).references('id').inTable('users').onDelete('CASCADE');
            table.text('content').notNullable();
            table.timestamp('datetime').defaultTo(knex.fn.now());
        });
    }
    if (!await knex.schema.hasTable('likes')) {
        await knex.schema.createTable('likes', (table) => {
            table.increments('id').primary();
            table.string('userid', 20).references('id').inTable('users').onDelete('CASCADE');
            table.uuid('messageid').references('id').inTable('messages').onDelete('CASCADE');
            table.unique(['userid', 'messageid']);

            table.index(['messageid']);
            table.index(['userid']);
        });
    }
    if (!await knex.schema.hasTable('sessions')) {
        // les sessionID ainsi que les dates d'expiration sont créées automatiquement lors d'une insertion de valeur
        await knex.schema.createTable('sessions', (table) => {
            table.string('id', 64).primary().defaultTo(knex.raw("encode(gen_random_bytes(32), 'hex')"));
            table.string('userid', 20).references('id').inTable('users').onDelete('CASCADE');
            table.timestamp('expiration').notNullable().defaultTo(knex.raw("NOW() + INTERVAL '24 hours'")); // durée de 24h pour une session
        });
    }

    await knex.destroy(); // kill la connexion a la BDD
}


create_tables();



