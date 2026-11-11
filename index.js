import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

// ⚠️ استبدل الرقم التالي برقم هاتفك المربوط بواتساب مع رمز الدولة بدون (+)
// مثال لليمن: 967XXXXXXXXX | مثال للسعودية: 966XXXXXXXXX
const PHONE_NUMBER = "967783970472"; 

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    // توليد رمز الاقتران لرقم الهاتف عند أول تشغيل
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(PHONE_NUMBER);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n==========================================");
                console.log(`🔑 رمز اقتران الواتساب الخاص بك هو: ${code}`);
                console.log("==========================================\n");
            } catch (err) {
                console.log("خطأ في طلب رمز الاقتران:", err);
            }
        }, 4000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
                : true;
            console.log('انقطع الاتصال، جاري إعادت التوصيل...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ تم الاتصال بحساب الواتساب بنجاح! البوت يعمل الآن.');
        }
    });

    // الاستجابة للرسائل القادمة
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe && msg.message) {
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
                    const from = msg.key.remoteJid;

                    // رد تلقائي عند إرسال كلمة (سلام) أو (مرحبا) أو (شغال)
                    if (['سلام', 'مرحبا', 'شغال', 'بوت'].includes(text.trim().toLowerCase())) {
                        await sock.sendMessage(from, { 
                            text: `أهلاً بك 👋\n\nأنا بوت الواتساب الخاص بك، أعمل حالياً بنجاح على منصة Render 🚀` 
                        });
                    }
                }
            }
        }
    });
}

connectToWhatsApp();
