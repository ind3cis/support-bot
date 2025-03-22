// commands/ping.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Répond avec Pong !'),
  
  async execute(interaction, client, db) {
    // La logique de ta commande ici
    await interaction.reply('Pong!');
  },
};
