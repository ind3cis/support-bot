// events/interactionCreate.js
module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client, db) {
      if (!interaction.isCommand()) return;
  
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
  
      try {
        await command.execute(interaction, client, db);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Une erreur est survenue lors de l’exécution de la commande.', ephemeral: true });
      }
    },
  };
  