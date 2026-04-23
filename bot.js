const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const axios = require('axios');

// =====================
// 🔑 TOKENS
// =====================

const bot = new Telegraf('8699879232:AAFFyFjXgVbFUEFvqtXpLrTLmEonxrDg9bc');
const CRYPTO_PAY_TOKEN = '571864:AAHhdcKDSZCfarR0SSrGV9k9kEOpYtbVrnC';

const ADMIN_ID = 566489906;

// =====================
// 📦 DATABASE
// =====================

let orders = {};
let orderCount = 0;

function loadDB() {
    try {
        orders = JSON.parse(fs.readFileSync('orders.json', 'utf8'));
    } catch (e) {
        orders = {};
    }
}

function saveDB() {
    fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2));
}

// =====================
// 🆔 ORDER ID
// =====================

function generateOrderId() {
    orderCount++;
    return "ORD-" + orderCount;
}

// =====================
// 💰 CREATE INVOICE
// =====================

async function createInvoice(amount, orderId) {
    const res = await axios.post(
        'https://pay.crypt.bot/api/createInvoice',
        {
            asset: "USDT",
            amount: amount,
            description: `SkinShop Order ${orderId}`,
            hidden_message: "Thanks!"
        },
        {
            headers: {
                'Crypto-Pay-API-Token': CRYPTO_PAY_TOKEN
            }
        }
    );

    return res.data.result;
}

// =====================
// 🛠 ADMIN MESSAGE
// =====================

function sendOrderToAdmin(order, userId) {
    bot.telegram.sendMessage(
        ADMIN_ID,
        `📦 ORDER\n\n🆔 ${order.id}\n🎮 ${order.skin}\n🔗 ${order.trade}\n📌 STATUS: ${order.status}`,
        Markup.inlineKeyboard([
            Markup.button.callback("💰 PAID", `paid_${userId}`),
            Markup.button.callback("📦 SENT", `sent_${userId}`),
            Markup.button.callback("❌ CANCEL", `cancel_${userId}`)
        ])
    );
}

// =====================
// 🚀 START
// =====================

bot.start((ctx) => {
    const payload = ctx.startPayload;
    const userId = ctx.from.id;

    if (payload) {
        const order = {
            id: generateOrderId(),
            skin: payload,
            status: "NEW",
            userId
        };

        orders[userId] = order;
        saveDB();

        ctx.reply(
            `🛒 Заказ создан!\n\n🎮 ${payload}\n🆔 ${order.id}\n\nОтправь Steam Trade Link 🔗`
        );
    } else {
        ctx.reply("Напиши название скина.");
    }
});

// =====================
// 💬 MESSAGE HANDLER
// =====================

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (!orders[userId]) {
        const order = {
            id: generateOrderId(),
            skin: text,
            status: "NEW",
            userId
        };

        orders[userId] = order;
        saveDB();

        ctx.reply("Теперь отправь Steam Trade Link 🔗");
        return;
    }

    if (!orders[userId].trade) {
        orders[userId].trade = text;
        orders[userId].status = "WAITING_PAYMENT";
        saveDB();

        const order = orders[userId];

        try {
            const invoice = await createInvoice(10, order.id);

            ctx.reply(
                `✅ Заказ создан!\n\n🆔 ${order.id}\n🎮 ${order.skin}\n\n💰 Оплата:\n${invoice.pay_url}`
            );

            sendOrderToAdmin(order, userId);

        } catch (err) {
            console.log(err);
            ctx.reply("❌ Ошибка оплаты");
        }
    }
});

// =====================
// 📦 /ORDERS COMMAND
// =====================

bot.command('orders', (ctx) => {

    if (ctx.from.id !== ADMIN_ID) {
        return ctx.reply("❌ нет доступа");
    }

    const all = Object.values(orders);

    if (all.length === 0) {
        return ctx.reply("📭 заказов нет");
    }

    let text = "📦 ALL ORDERS\n\n";

    all.forEach(order => {
        text += `🆔 ${order.id}\n`;
        text += `🎮 ${order.skin}\n`;
        text += `📌 ${order.status}\n`;
        text += `🔗 ${order.trade || "no trade link"}\n`;
        text += `--------------------\n`;
    });

    ctx.reply(text);
});

// =====================
// 🔘 ADMIN BUTTONS
// =====================

bot.action(/paid_(.+)/, (ctx) => {
    const userId = ctx.match[1];

    if (orders[userId]) {
        orders[userId].status = "PAID";
        saveDB();

        ctx.reply("💰 PAID");

        bot.telegram.sendMessage(
            userId,
            `💰 Оплата подтверждена!\n🆔 ${orders[userId].id}`
        );
    }
});

bot.action(/sent_(.+)/, (ctx) => {
    const userId = ctx.match[1];

    if (orders[userId]) {
        orders[userId].status = "SENT";
        saveDB();

        ctx.reply("📦 SENT");

        bot.telegram.sendMessage(
            userId,
            `📦 Скин отправлен!\n🆔 ${orders[userId].id}`
        );
    }
});

bot.action(/cancel_(.+)/, (ctx) => {
    const userId = ctx.match[1];

    if (orders[userId]) {
        orders[userId].status = "CANCELLED";
        saveDB();

        ctx.reply("❌ CANCELLED");

        bot.telegram.sendMessage(
            userId,
            `❌ заказ отменён`
        );
    }
});

// =====================
// INIT
// =====================

loadDB();

bot.launch();

console.log("🚀 Bot running with /orders + admin panel...");