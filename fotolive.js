/**
‎✧ Name   : foto live
‎✧ Creator  : Rin imup
‎✧ Category : tools
‎✧ sumber : https://whatsapp.com/channel/0029Vb6EHtR5Ui2gHMW9zX2x
‎✧ *Note* : foto live guna nya ya ga guna 👍
‎**/

import fs from 'fs';
import os from 'os';
import flPath from 'path';
import ffFotoLive from 'fluent-ffmpeg';
import { downloadContentFromMessage, prepareWAMessageMedia, generateWAMessageFromContent } from '@itsliaaa/baileys';

let handler = async (m, { conn, isOwner }) => {
    const flTmpVideo = flPath.join(os.tmpdir(), `lv_video_${Date.now()}.mp4`);
    const flTmpThumb = flPath.join(os.tmpdir(), `lv_thumb_${Date.now()}.jpg`);

    try {
        const q = m.quoted ? m.quoted : m;
        const mime = (q.msg || q).mimetype || q.mimetype || '';

        if (!mime.includes('video')) {
            return m.reply('Balas/reply video yang valid untuk dijadikan Live Photo ya kak~');
        }

        let flVideoBuffer;
        
        if (typeof q.download === 'function') {
            flVideoBuffer = await q.download();
        } else {
            const flVideoMsgObj = q.msg || q; 
            
            if (!flVideoMsgObj || (!flVideoMsgObj.mediaKey && !flVideoMsgObj.url)) {
                return m.reply('Media key tidak ditemukan, pastikan reply video yang valid ya kak~');
            }

            const flStream = await downloadContentFromMessage(flVideoMsgObj, 'video');
            let chunks = [];
            for await (const chunk of flStream) {
                chunks.push(chunk);
            }
            flVideoBuffer = Buffer.concat(chunks);
        }

        if (!flVideoBuffer || flVideoBuffer.length === 0) {
             return m.reply('Gagal mendownload video kak~');
        }

        fs.writeFileSync(flTmpVideo, flVideoBuffer);

        await new Promise((resolve, reject) => {
            ffFotoLive(flTmpVideo)
                .outputOptions(['-vframes 1', '-q:v 2'])
                .output(flTmpThumb)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        const flThumbBuffer = fs.readFileSync(flTmpThumb);
        
        const flImageMedia = await prepareWAMessageMedia(
            { image: flThumbBuffer },
            { upload: conn.waUploadToServer }
        );
        const flVideoMedia = await prepareWAMessageMedia(
            { video: flVideoBuffer },
            { upload: conn.waUploadToServer }
        );

        const flPhotoMsg = generateWAMessageFromContent(
            m.chat,
            {
                imageMessage: {
                    ...flImageMedia.imageMessage,
                    contextInfo: { pairedMediaType: 5, statusSourceType: 0 }
                }
            },
            { quoted: m }
        );
        
        await conn.relayMessage(m.chat, flPhotoMsg.message, { messageId: flPhotoMsg.key.id });

        await conn.relayMessage(
            m.chat,
            {
                videoMessage: {
                    ...flVideoMedia.videoMessage,
                    contextInfo: { pairedMediaType: 6, statusSourceType: 0 }
                },
                messageContextInfo: {
                    messageAssociation: { associationType: 12, parentMessageKey: flPhotoMsg.key }
                }
            },
            {}
        );

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('fotolive error:', e);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        m.reply('❌ Gagal membuat foto live-nya kak~ coba lagi nanti ya 🌸');
    } finally {
        try { if (fs.existsSync(flTmpVideo)) fs.unlinkSync(flTmpVideo); } catch (_) {}
        try { if (fs.existsSync(flTmpThumb)) fs.unlinkSync(flTmpThumb); } catch (_) {}
    }
}

handler.help = ['fotolive']
handler.tags = ['maker', 'tools']
handler.command = /^(fotolive|livephoto|livepic)$/i

export default handler
