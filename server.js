import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static('public'));
app.use(express.json());

app.post('/api/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не получен' });
    }

    const filePath = req.file.path;
    const tempPath = `${filePath}.webm`;
    fs.renameSync(filePath, tempPath);

    // 1. Распознавание речи с помощью Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
    });

    const userText = transcription.text;

    // 2. Генерация текстового ответа от GPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Ты короткий, дружелюбный и полезный голосовой ассистент ARP.' },
        { role: 'user', content: userText }
      ],
    });

    const aiText = completion.choices[0].message.content;

    // 3. Озвучивание ответа голосом Onyx
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: aiText,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    // Удаляем временный файл
    fs.unlinkSync(tempPath);

    // Отправляем ответ клиенту
    res.json({
      userText: userText,
      text: aiText,
      audio: base64Audio,
    });
  } catch (error) {
    console.error('Ошибка обработки voice-arp:', error);
    res.status(500).json({ error: 'Ошибка обработки на сервере' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});