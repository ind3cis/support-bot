// commands/sendticket.js
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
  } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  
  // Importe ta connexion MySQL depuis index.js
  const { db } = require('../index');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('sendticket')
      .setDescription('Envoie (ou met à jour) le panel pour ouvrir un ticket'),
  
    async execute(interaction) {
      // On défère la réponse pour éviter tout timeout
      await interaction.deferReply({ ephemeral: true });
  
      // Lecture du fichier de config local
      const configPath = path.join(__dirname, '..', 'ticketConfig.json');
      if (!fs.existsSync(configPath)) {
        return interaction.editReply({ content: 'Fichier ticketConfig.json introuvable.' });
      }
  
      const ticketConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
      try {
        // Vérifier si on a déjà un panel dans la DB pour ce serveur
        const [rows] = await db.execute(
          'SELECT * FROM ticket_panels WHERE guild_id = ?',
          [interaction.guild.id]
        );
  
        // Construisons l’embed du panel
        const panelEmbed = new EmbedBuilder()
          .setTitle(ticketConfig.title)
          .setDescription(ticketConfig.description)
          .setColor('#0099ff'); // Couleur au choix
  
        // Construisons le bouton
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel(ticketConfig.buttonLabel)
            .setEmoji(ticketConfig.buttonEmoji)
            .setStyle(ButtonStyle.Primary)
        );
  
        if (rows.length > 0) {
          // On a déjà un panel : on tente de mettre à jour ce message
          const panel = rows[0];
  
          try {
            const channel = interaction.guild.channels.cache.get(panel.channel_id);
            if (!channel) {
              throw new Error('Salon introuvable');
            }
            const msg = await channel.messages.fetch(panel.message_id);
            if (!msg) {
              throw new Error('Message introuvable');
            }
            // Éditer le message existant
            await msg.edit({
              embeds: [panelEmbed],
              components: [row]
            });
  
            // Répondre qu’on a tout mis à jour
            await interaction.editReply({ content: 'Panel mis à jour !' });
          } catch (err) {
            console.error('Erreur maj panel:', err);
  
            // Supprimer l’ancienne entrée DB
            await db.execute(
              'DELETE FROM ticket_panels WHERE guild_id = ?',
              [interaction.guild.id]
            );
  
            // Recréer un nouveau panel
            await createNewPanel();
            // On fait un seul "editReply" après, pour ne pas multiplier les réponses
            await interaction.editReply({ content: 'Le panel précédent était introuvable. Nouveau panel créé !' });
          }
        } else {
          // Pas de panel, on crée un nouveau message panel
          await createNewPanel();
          await interaction.editReply({ content: 'Panel créé avec succès !' });
        }
  
        // Fonction helper pour créer un nouveau panel
        async function createNewPanel() {
          const panelMsg = await interaction.channel.send({
            embeds: [panelEmbed],
            components: [row]
          });
          // On stocke en DB
          await db.execute(
            'INSERT INTO ticket_panels (guild_id, channel_id, message_id) VALUES (?, ?, ?)',
            [interaction.guild.id, interaction.channel.id, panelMsg.id]
          );
        }
      } catch (error) {
        console.error('Erreur générale /sendticket :', error);
        await interaction.editReply({ content: `Erreur : ${error.message}` });
      }
    }
  };
  