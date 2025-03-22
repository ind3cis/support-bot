// index.js
require('dotenv').config(); // Pour charger les variables d’environnement
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

// Création du client Discord (ajuste les Intents en fonction de tes besoins)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// Connexion MySQL (optionnel, tu peux le faire ailleurs si tu préfères)
let db;
(async () => {
  try {
    db = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('Connecté à la base de données MySQL !');
  } catch (error) {
    console.error('Erreur de connexion à la base de données :', error);
  }
})();

// Collection des commandes (slash commands)
client.commands = new Collection();

// Chargement des commandes depuis le dossier "commands"
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  // Vérifie que ta commande a bien un nom et un execute
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[AVERTISSEMENT] La commande dans ${filePath} n'a pas de "data" ou "execute".`);
  }
}

// Chargement des événements depuis le dossier "events"
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  // Les événements "once" et "on" 
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client, db));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client, db));
  }
}

// Lancement du bot
client.login(process.env.DISCORD_TOKEN).then(() => {
  console.log('Bot en cours de connexion...');
}).catch(err => {
  console.error('Impossible de se connecter :', err);
});

module.exports = { db };
