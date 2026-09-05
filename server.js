import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './knowledgeBase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Чтение базы АРП-Педагогики из файла arp-pedagog.txt
const pedagogPath = path.join(__dirname, 'arp-pedagog.txt');
let pedagogKnowledge = '';
try {
  pedagogKnowledge = fs.readFileSync(pedagogPath, 'utf8');
  console.log('База АРП-Педагогики успешно загружена');
} catch (err) {
  console.error('Ошибка чтения arp-pedagog.txt:', err.message);
}

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Хранилище истории диалогов в памяти
const userHistories = new Map();

// Объединяем новый глобальный ARP Voice Prompt с педагогической базой
const fullSystemPrompt = `${SYSTEM_PROMPT}

SPECIAL MODE "ARP-PEDAGOGUE":
If the user asks about raising children, education, school, discipline, behavior, teachers, or parents, apply guidance from the Ak-Bermet ARP-Pedagogy framework:
--- START ARP PEDAGOGY BASE ---
${pedagogKnowledge}
--- END ARP PEDAGOGY BASE ---
`;

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  const history = userHistories.get(userId) || [];
  res.json({ history });
});

app.post('/api/voice', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Аудиофайл не передан' });
  }

  const filePath = req.file.path;
  const userId = req.body.userId || 'default_user';

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const audioFile = await OpenAI.toFile(fileBuffer, 'recording.webm', { type: 'audio/webm' });

    // Распознавание речи через Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const userText = transcription.text;

    if (!userText || !userText.trim()) {
      return res.json({ userText: '', text: '', audio: null });
    }

    // История сообщений
    if (!userHistories.has(userId)) {
      userHistories.set(userId, []);
    }
    const history = userHistories.get(userId);

    history.push({ role: 'user', content: userText });
    if (history.length > 10) history.shift();

    // Ответ от GPT с расширенным лимитом токенов для полноценных ответов
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 350,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...history
      ]
    });

    const assistantText = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: assistantText });

    // Озвучка ответа через TTS
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: assistantText,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    res.json({
      userText,
      text: assistantText,
      audio: base64Audio
    });

  } catch (error) {
    console.error('Ошибка бэкенда:', error);
    res.status(500).json({ error: error.message || 'Ошибка обработки голосового запроса' });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Текст не передан' });

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    res.json({ audio: base64Audio });
  } catch (error) {
    console.error('Ошибка TTS:', error);
    res.status(500).json({ error: 'Ошибка генерации озвучки' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});