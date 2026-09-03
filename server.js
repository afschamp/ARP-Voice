import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const userHistories = new Map();

function getHistory(userId) {
  if (!userHistories.has(userId)) {
    userHistories.set(userId, [
      {
        role: "system",
        content: `Ты — голосовой ассистент методологии ARP (Algorithm for Resolution of the Problem). 
Твоя цель — помогать пользователю анализировать его задачи, желания (Desire) и возможности (Ability).
Будь дружелюбным, естественным и гибким собеседником. 
Если пользователь задает простой или отвлеченный вопрос (например, сколько будет 1+1, приветствие или бытовые вопросы), кратко и понятливо ответь на него, а затем мягко переведи беседу к его текущим целям или задачам.
Отвечай кратко, емко и естественно (1-3 предложения), так как твои ответы озвучиваются вслух.`
      }
    ]);
  }
  return userHistories.get(userId);
}

app.get('/api/history/:userId', (req, res) => {
  const history = getHistory(req.params.userId);
  const cleanHistory = history.filter(msg => msg.role !== 'system');
  res.json({ history: cleanHistory });
});

app.post('/api/voice', upload.single('audio'), async (req, res) => {
  const userId = req.body.userId || 'default_user';
  const history = getHistory(userId);
  const filePath = req.file ? req.file.path : null;

  if (!filePath) {
    return res.status(400).json({ error: 'Аудиофайл не передан' });
  }

  try {
    // 1. Распознавание речи (STT)
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: 'ru',
    });

    const userText = transcription.text;
    if (!userText || userText.trim() === '') {
      fs.unlinkSync(filePath);
      return res.json({ userText: '', text: 'Я вас не услышал. Повторите, пожалуйста.', audio: '' });
    }

    history.push({ role: 'user', content: userText });

    // 2. Генерация ответа (LLM)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: history,
    });

    const assistantText = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: assistantText });

    // 3. Озвучка ответа (TTS)
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: assistantText,
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    fs.unlinkSync(filePath);

    res.json({
      userText,
      text: assistantText,
      audio: base64Audio,
    });
  } catch (error) {
    console.error('Ошибка обработки голоса:', error);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Ошибка сервера при обработке аудио' });
  }
});

app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Текст не передан' });

  try {
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: text,
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    res.json({ audio: base64Audio });
  } catch (error) {
    console.error('Ошибка TTS:', error);
    res.status(500).json({ error: 'Ошибка генерации речи' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});