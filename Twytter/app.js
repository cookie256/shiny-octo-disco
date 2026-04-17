/**
 * app.js
 * 
 * Fichier qui sert de point d'entrée du serveur Express
 * Il sert à configurer middleware, se connecter à la BDD
 * IL sert également les fichier static et démarre le serveur 
 */

const https = require("https");
const http = require("http");
const fs = require("fs");

const express = require('express');
const app = express();
const routes = require('./routes/routes');
const db = require('./db');
const path = require('path');


// Middleware pour lire JSON
app.use(express.json());

// Routes API
app.use('/', routes);

// Fichiers statiques (HTML, CSS, JS client)
app.use(express.static(path.join(__dirname, './pub')));

/**
 * Route principale (index.html)
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './pub/index.html'));
});

/**
 * Démarre sur le port 3000 (HTTP) et 8443 (HTTPS) si exécuté en local
 */
if (process.env.NODE_ENV !== 'production') {
  console.log("\nApplication lancée avec succès :\n")
  var httpServer = http.createServer(app);
  httpServer.listen(3000, () => {
    console.log('HTTP : http://localhost:3000')
  });  

  try {
    const options = {
      key: fs.readFileSync('localhost-key.pem'),
      cert: fs.readFileSync('localhost.pem'),
    };
    var httpsServer = https.createServer(options, app);
    httpsServer.listen(8443, () => {
      console.log('HTTPS : https://localhost:8443')
    });
  } catch (err) {
    console.log('HTTPS : Certificats introuvables, échec du démarrage sous HTTPS.');
  }
}

// exporte l'app pour démarrage sur vercel
module.exports = app;