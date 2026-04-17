# En cas d'erreur, merci de bien vérifier que DATABASE_URL est correctement renseigné dans Twytter/.env

all: install certs start

install:
	cd Twytter && npm install && node db_init.js

certs:
	cd Twytter && mkcert -install && mkcert localhost

start:
	cd Twytter && npm start