// events/ready.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Connecté en tant que ${client.user.tag}`);

    // Optionnel : Définir la présence
    client.user.setPresence({
      activities: [{ name: 'Création de tickets' }],
      type: 'CUSTOM',
      status: 'online',
    });

    // 1) Lire toutes tes commandes
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // 2) Construire un tableau "slashCommands" pour l'API
    const slashCommands = [];
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if (command.data) {
        slashCommands.push(command.data.toJSON());
      }
    }

    // 3) Instancier REST et enregistrer les commandes
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
      console.log('Déploiement des (slash) commands en cours...');

      // Enregistrement **global** des slash commands
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: slashCommands },
      );

      console.log('Les commandes slash ont bien été déployées globalement !');
    } catch (error) {
      console.error('Erreur lors du déploiement des commandes slash :', error);
    }
  },
};
