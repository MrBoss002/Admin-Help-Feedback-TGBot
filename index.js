const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Store user IDs in memory
const users = new Set();

// Keep-Alive Server
app.get('/', (req, res) => res.send('Admin Support Bot is running!'));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Start Command
bot.start((ctx) => {
  const userId = ctx.from.id;
  users.add(userId);

  const welcomeMessage = 
    `👋 **Welcome to Support & Feedback Bot!**\n\n` +
    `Send your message, question, or order inquiry here. Our admin team will receive it privately and reply to you directly.\n\n` +
    `⚠️ **Important Rules & Info:**\n` +
    `• Please state your question clearly in a single message.\n` +
    `• Do not spam, flood, or send unwanted promotional links.\n` +
    `• Your identity stays private—only admins will see your message.`;

  return ctx.replyWithMarkdown(
    welcomeMessage,
    Markup.inlineKeyboard([
      [
        Markup.button.url('📢 Telegram Channel', 'https://t.me/YOUR_CHANNEL_USERNAME'),
        Markup.button.url('📦 Bot Repository', 'https://github.com/MrBoss002/Admin-Help-Feedback-TGBot')
      ],
      [
        Markup.button.url('👨‍💻 Developer GitHub', 'https://github.com/MrBoss002')
      ]
    ])
  );
});

// Stats Command (Admin Only)
bot.command('stats', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.reply(`📊 **Bot Statistics:**\n\nTotal Users in Database: **${users.size}**`, { parse_mode: 'Markdown' });
});

// Broadcast Command (Admin Only)
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const replyTo = ctx.message.reply_to_message;
  const directText = ctx.message.text.replace('/broadcast', '').trim();

  if (!replyTo && !directText) {
    return ctx.reply(
      '⚠️ **How to Broadcast:**\n\n' +
      '• Send or forward any message, image, video, or post.\n' +
      '• **Reply** to that message with `/broadcast`',
      { parse_mode: 'Markdown' }
    );
  }

  // Auto-add admin ID if set is empty during testing
  users.add(ctx.from.id);

  const totalUsers = users.size;

  const statusMsg = await ctx.reply(
    `⏳ **BROADCAST PROCESSING...**\n\n` +
    `**TOTAL USERS:** ${totalUsers}\n` +
    `**COMPLETED:** 0 / ${totalUsers}\n` +
    `**SUCCESS:** 0\n` +
    `**FAILED:** 0`,
    { parse_mode: 'Markdown' }
  );

  let successCount = 0;
  let failCount = 0;
  let processed = 0;

  for (const userId of users) {
    try {
      if (replyTo) {
        await bot.telegram.copyMessage(userId, ctx.chat.id, replyTo.message_id);
      } else {
        await bot.telegram.sendMessage(userId, directText);
      }
      successCount++;
    } catch (err) {
      failCount++;
    }

    processed++;

    if (processed % 5 === 0 || processed === totalUsers) {
      try {
        await bot.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          null,
          `⏳ **BROADCAST PROCESSING...**\n\n` +
          `**TOTAL USERS:** ${totalUsers}\n` +
          `**COMPLETED:** ${processed} / ${totalUsers}\n` +
          `**SUCCESS:** ${successCount}\n` +
          `**FAILED:** ${failCount}`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {}
    }
  }

  await ctx.reply(
    `📌 **<u>Broadcast Completed</u>**\n\n` +
    `◇ **Total Users:** ${totalUsers}\n` +
    `◇ **Successful:** ${successCount}\n` +
    `◇ **Failed / Blocked:** ${failCount}`,
    { parse_mode: 'HTML' }
  );
});

// Main Message Handler
bot.on('message', async (ctx) => {
  const senderId = ctx.from.id;
  const text = ctx.message.text || '';

  // Skip commands starting with /
  if (text.startsWith('/')) return;

  // 1. IF ADMIN IS SENDING A MESSAGE
  if (senderId === ADMIN_ID) {
    const replyTo = ctx.message.reply_to_message;
    if (!replyTo) {
      return ctx.reply('To answer a user, reply directly to their forwarded message!');
    }

    let targetUserId = null;
    if (replyTo.forward_from) {
      targetUserId = replyTo.forward_from.id;
    } else if (replyTo.text && replyTo.text.includes('ID:')) {
      const match = replyTo.text.match(/ID:\s*(\d+)/);
      if (match) targetUserId = parseInt(match[1]);
    } else if (replyTo.caption && replyTo.caption.includes('ID:')) {
      const match = replyTo.caption.match(/ID:\s*(\d+)/);
      if (match) targetUserId = parseInt(match[1]);
    }

    if (targetUserId) {
      try {
        await ctx.copyMessage(targetUserId);
        ctx.reply('✅ Reply sent to user successfully!');
      } catch (err) {
        ctx.reply(`❌ Failed to send message: ${err.message}`);
      }
    } else {
      ctx.reply('Could not identify which user to reply to.');
    }
    return;
  }

  // 2. IF REGULAR USER SENDS A MESSAGE
  users.add(senderId);

  const userInfo = `📩 **New Support Message**\nFrom: ${ctx.from.first_name} ${ctx.from.last_name || ''}\nUsername: @${ctx.from.username || 'None'}\nID: \`${senderId}\``;

  try {
    await bot.telegram.sendMessage(ADMIN_ID, userInfo, { parse_mode: 'Markdown' });
    await ctx.copyMessage(ADMIN_ID);
  } catch (err) {
    console.error('Error forwarding message to admin:', err);
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
