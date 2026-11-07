import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,role @user <role>` — toggles: adds when missing, removes when present. */

export const name = 'role';

export async function prefix(message, args) {
  const err = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });
  const ok = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(text)] });

  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return err('⚠️ You need **Manage Roles** permission.');
  }

  const target = message.mentions.members.first();
  if (!target) return err('⚠️ Usage: `,role @user <role name or @role>`');

  const roleQuery = args.slice(1).join(' ').trim();
  if (!roleQuery) {
    return err('⚠️ Please specify a role name or mention a role.\n**Usage:** `,role @user <role name>`');
  }

  const role = message.mentions.roles.first()
    ?? message.guild.roles.cache.find((candidate) => candidate.name.toLowerCase() === roleQuery.toLowerCase()
      || candidate.name.toLowerCase().includes(roleQuery.toLowerCase().replace(/<@&\d+>/g, '').trim()));

  if (!role) return err(`❌ Role \`${roleQuery}\` not found. Check the name and try again.`);

  if (role.managed) return err('❌ That role is managed by an integration and cannot be assigned manually.');
  if (role.position >= message.guild.members.me.roles.highest.position) {
    return err('⚠️ That role is higher than my highest role. Move my role above it first.');
  }
  if (role.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
    return err('⚠️ That role is equal to or higher than your own highest role.');
  }

  if (target.roles.cache.has(role.id)) {
    await target.roles.remove(role);
    return ok(`✅ Removed **${role.name}** from **${target.user.username}**.`);
  }

  await target.roles.add(role);
  return ok(`✅ Added **${role.name}** to **${target.user.username}**.`);
}
