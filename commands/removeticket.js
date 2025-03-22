// commands/removeticket.js
const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../index');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeticket')
    .setDescription('Supprime le panel de ticket pour ce serveur.'),

  async execute(interaction) {
    // On cherche l’entrée
    const [rows] = await db.execute(
      'SELECT * FROM ticket_panels WHERE guild_id = ?',
      [interaction.guild.id]
    );

    if (rows.length === 0) {
      return interaction.reply({ content: 'Aucun panel trouvé pour ce serveur.', ephemeral: true });
    }

    const panel = rows[0];
    let success = false;
    try {
      const channel = interaction.guild.channels.cache.get(panel.channel_id);
      if (channel) {
        const msg = await channel.messages.fetch(panel.message_id);
        if (msg) {
          await msg.delete();
        }
      }
      success = true;
    } catch (err) {
      console.log('Erreur lors de la suppression du panel:', err);
    }

    // On supprime l’entrée en DB quoi qu’il arrive
    await db.execute(
      'DELETE FROM ticket_panels WHERE guild_id = ?',
      [interaction.guild.id]
    );

    if (success) {
      await interaction.reply({ content: 'Panel supprimé.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Le message n’a pas pu être trouvé, mais l’entrée est supprimée de la BDD.', ephemeral: true });
    }
  }
};
