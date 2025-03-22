// events/interactionCreate.js
const {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { db } = require('../index');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;

    // Lecture du fichier config
    const configPath = path.join(__dirname, '..', 'ticketConfig.json');
    if (!fs.existsSync(configPath)) return; // Pas de config => pas d'action
    const ticketConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // 1) Ouvrir un ticket
    if (interaction.customId === 'open_ticket') {
      // Créer un salon
      const channelName = ticketConfig.ticketChannelName
        .replace('{user}', interaction.user.username)
        .replace('{userId}', interaction.user.id);

      // On peut mentionner des rôles si besoin :
      const mentionRoles = ticketConfig.mentionRoles || [];

      try {
        const newChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: ticketConfig.ticketCategoryId, // la catégorie
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone, // Tout le monde
              deny: [PermissionFlagsBits.ViewChannel],
            },
            // Donner accès à la personne qui ouvre
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ],
            },
            // Donner accès aux rôles modérateurs
            ...ticketConfig.moderatorRoles.map(roleId => ({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
              ],
            }))
          ],
        });

        // Insérer en DB
        await db.execute(
          'INSERT INTO tickets (channel_id, guild_id, opener_id) VALUES (?, ?, ?)',
          [newChannel.id, interaction.guild.id, interaction.user.id]
        );

        // Envoyer un embed "Ticket ouvert" avec boutons Claim et Close
        const ticketEmbed = new EmbedBuilder()
          .setTitle(ticketConfig.title || 'Ticket')
          .setDescription(`Ticket ouvert par <@${interaction.user.id}>.\n\nAppuie sur **${ticketConfig.claimButtonLabel}** pour prendre en charge ce ticket ou sur **${ticketConfig.closeButtonLabel}** pour fermer.`)
          .setColor('#00FF00');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel(ticketConfig.claimButtonLabel || 'Claim')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel(ticketConfig.closeButtonLabel || 'Fermer')
            .setStyle(ButtonStyle.Danger),
        );

        const msg = await newChannel.send({
          content: mentionRoles.map(r => `<@&${r}>`).join(' '), // ping éventuel
          embeds: [ticketEmbed],
          components: [row],
        });

        await interaction.reply({ content: `Ticket créé : ${newChannel}`, ephemeral: true });
      } catch (err) {
        console.error('Erreur creation ticket:', err);
        await interaction.reply({ content: 'Erreur lors de la création du ticket.', ephemeral: true });
      }
    }

    // 2) Claim le ticket
    else if (interaction.customId === 'claim_ticket') {
      const channel = interaction.channel;

      // Vérifier si c’est bien un channel de ticket
      const [rows] = await db.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
      if (rows.length === 0) {
        return interaction.reply({ content: 'Ce channel ne semble pas être un ticket.', ephemeral: true });
      }
      const ticketData = rows[0];

      // Mettre à jour le claimed_by
      if (ticketData.claimed_by) {
        return interaction.reply({ content: 'Ce ticket est déjà claim.', ephemeral: true });
      }

      await db.execute('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?', [interaction.user.id, channel.id]);

      // Optionnel : renommer le salon pour indiquer le staff
      // e.g. "ticket-{user}-claimed" ou "ticket-{staffName}"
      try {
        await channel.setName(`${channel.name}-claimed`);
      } catch (err) {
        console.log('Impossible de rename le channel', err);
      }

      await interaction.reply({ content: `Ticket claim par <@${interaction.user.id}>.`, ephemeral: false });
    }

    // 3) Fermer le ticket
    else if (interaction.customId === 'close_ticket') {
      const channel = interaction.channel;

      // Vérifier si c’est bien un channel de ticket
      const [rows] = await db.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
      if (rows.length === 0) {
        return interaction.reply({ content: 'Ce channel ne semble pas être un ticket.', ephemeral: true });
      }

      // On supprime l’entrée en DB
      await db.execute('DELETE FROM tickets WHERE channel_id = ?', [channel.id]);

      // On peut supprimer le salon ou le lock
      await interaction.reply({ content: 'Fermeture du ticket...' });
      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 2000);
    }
  }
};
