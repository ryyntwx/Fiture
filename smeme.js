/**
‎✧ Name   : smeme support image & vidio
‎✧ Creator   : Rin imup/princes
‎✧ Sumber  : https://whatsapp.com/channel/0029Vb6EHtR5Ui2gHMW9zX2x
‎✧ *Note* : Jangan hapus wm ya ,eh iya sesuikan lagi aja ya pas jadi sticker nya itu kalo vidio kadang ga ke unduh jadi atur lagi aja
‎**/

import { Sticker } from 'wa-sticker-formatter'
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { createCanvas } from '@napi-rs/canvas'
import ffmpegInst from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'

ffmpeg.setFfmpegPath(ffmpegInst.path)

async function uguu(filePath) {
  const form = new FormData()
  form.append('files[]', fs.createReadStream(filePath))

  const { data } = await axios.post(
    'https://uguu.se/upload',
    form,
    { headers: { ...form.getHeaders() } }
  )

  return data.files[0].url
}

async function getSmemeUrl(atas, bawah, bg) {
  const primary = `https://api-faa.my.id/faa/smeme?text_atas=${encodeURIComponent(atas)}&text_bawah=${encodeURIComponent(bawah)}&background=${encodeURIComponent(bg)}`

  try {
    const res = await axios.get(primary, {
      responseType: 'arraybuffer',
      timeout: 15000
    })

    if (Buffer.isBuffer(res.data) && res.data.length > 1000) {
      return primary
    }
  } catch (e) {
    console.log('FAA API Error:', e.message)
  }

  return `https://api.memegen.link/images/custom/${encodeURIComponent(atas)}/${encodeURIComponent(bawah)}.png?background=${bg}`
}

function drawSmvText(ctx, txt, x, y, w, isBottom) {
  if (!txt) return
  ctx.fillStyle = 'white'
  ctx.strokeStyle = 'black'
  ctx.textAlign = 'center'
  ctx.textBaseline = isBottom ? 'bottom' : 'top'
  ctx.lineJoin = 'round'
  
  let fontSize = Math.floor(w / 8)
  ctx.font = `bold ${fontSize}px Impact, Arial`
  
  while (ctx.measureText(txt).width > w - 20) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px Impact, Arial`
    if (fontSize < 10) break
  }
  
  ctx.lineWidth = Math.floor(fontSize / 6)
  ctx.strokeText(txt, x, y)
  ctx.fillText(txt, x, y)
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  let q = m.quoted ? m.quoted : m
  let mime = (q.msg || q).mimetype || q.mediaType || ''

  const react = async (emoji) => {
    try {
      await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    } catch (e) {}
  }

  if (!text) {
    return m.reply(`Contoh:\n${usedPrefix + command} teks atas|teks bawah`)
  }

  if (!/image|video/.test(mime)) {
    return m.reply(`Balas gambar atau video dengan caption:\n${usedPrefix + command} teks atas|teks bawah`)
  }

  let [atas, bawah] = text.split('|')
  atas = (atas || ' ').trim().toUpperCase()
  bawah = (bawah || ' ').trim().toUpperCase()

  await react('🕐')

  const tempId = Date.now()
  let packname = global.stickpack || 'RINN'
  let author = global.stickauth || 'MD'
  
  if (/video/g.test(mime)) {
    if ((q.msg || q).seconds > 10) {
      await react('❌')
      return m.reply('Maksimal durasi video adalah 10 detik!')
    }

    let smvBuf
    try {
      if (m.quoted) {
        smvBuf = await m.quoted.download()
      } else {
        const stream = await downloadContentFromMessage(q.msg || q, 'video')
        let tmp = Buffer.from([])
        for await (const chunk of stream) tmp = Buffer.concat([tmp, chunk])
        smvBuf = tmp
      }
    } catch (e) {
      console.error(e)
      await react('❌')
      return m.reply('Gagal mengunduh video, silakan coba lagi.')
    }

    const smvInputPath = path.join(os.tmpdir(), `smv-in-${tempId}.mp4`)
    const smvOutputPath = path.join(os.tmpdir(), `smv-out-${tempId}.webp`) 
    const smvOverlayPath = path.join(os.tmpdir(), `smv-overlay-${tempId}.png`)

    fs.writeFileSync(smvInputPath, smvBuf)

    try {
      const smvSize = 512
      const canvas = createCanvas(smvSize, smvSize)
      const ctx = canvas.getContext('2d')

      drawSmvText(ctx, atas, smvSize / 2, 15, smvSize, false)
      drawSmvText(ctx, bawah, smvSize / 2, smvSize - 15, smvSize, true)

      fs.writeFileSync(smvOverlayPath, canvas.toBuffer('image/png'))

      await new Promise((resolve, reject) => {
        ffmpeg(smvInputPath)
          .input(smvOverlayPath)
          .complexFilter([
            `[0:v]crop='min(iw,ih)':'min(iw,ih)',scale=${smvSize}:${smvSize},fps=8[vid]`,
            `[vid][1:v]overlay=0:0[out]`
          ])
          .outputOptions([
            '-map [out]',
            '-an',                      
            '-c:v libwebp',             
            '-pix_fmt yuva420p',        
            '-lossless 0',              
            '-compression_level 4',      
            '-q:v 40',                  
            '-loop 0',                  
            '-t 4'                      
          ])
          .save(smvOutputPath)
          .on('end', resolve)
          .on('error', reject)
      })

      let finalStickerBuffer = fs.readFileSync(smvOutputPath)
      
      await sendStickerViaNative(conn, m, finalStickerBuffer, {
        isAnimated: true,
        metadata: {
          'sticker-pack-name': packname,
          'sticker-pack-publisher': author,
        }
      })
      await react('✨')

    } catch (e) {
      console.error(e)
      await react('❌')
      m.reply('❌ Gagal memproses video menjadi meme sticker')
    } finally {
      if (fs.existsSync(smvInputPath)) fs.unlinkSync(smvInputPath)
      if (fs.existsSync(smvOutputPath)) fs.unlinkSync(smvOutputPath)
      if (fs.existsSync(smvOverlayPath)) fs.unlinkSync(smvOverlayPath)
    }

  } else {
    let buffer
    try {
      buffer = await q.download?.()
    } catch (e) {
      console.error(e)
      await react('❌')
      return m.reply('Gagal mengunduh gambar.')
    }

    let ext = mime.split('/')[1] || 'png'
    let tempFile = path.join(os.tmpdir(), `smeme_${tempId}.${ext}`)
    fs.writeFileSync(tempFile, buffer)

    try {
      let url = await uguu(tempFile)
      let memeUrl = await getSmemeUrl(atas, bawah, url)
      
      let stiker = await createSticker(false, memeUrl, packname, author, 80, 'full')

      await sendStickerViaNative(conn, m, stiker, {
        isAnimated: false,
        metadata: {
          'sticker-pack-name': packname,
          'sticker-pack-publisher': author,
        }
      })
      await react('✨')
    } catch (e) {
      console.error(e)
      await react('❌')
      m.reply('❌ Gagal membuat sticker memek')
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  }
}

handler.help = ['smeme <teks atas>|<teks bawah>']
handler.tags = ['sticker']
handler.command = /^smeme$/i
handler.limit = true

export default handler

async function createSticker(img, url, packName, authorName, quality = 70, type = 'full') {
    let stickerMetadata = { type, pack: packName, author: authorName, quality }
    return (new Sticker(img ? img : url, stickerMetadata)).toBuffer()
}

async function sendStickerViaNative(conn, m, stikerBuffer, opts = {}) {
    try {
        if (typeof sendNativeMemeSticker === 'function') {
            await sendNativeMemeSticker(conn, m, stikerBuffer, opts)
        } else {
            throw new Error('sendNativeMemeSticker not found')
        }
    } catch (e) {
        await conn.sendFile(m.chat, stikerBuffer, 'sticker.webp', '', m)
    }
}
