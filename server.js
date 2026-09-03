const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { toFile } = require('openai');

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
    // Преобразуем файл с явно указанным расширением webm
    const fileBuffer = fs.readFileSync(filePath);
    const audioFile = await toFile(fileBuffer, 'recording.webm', { type: 'audio/webm' });

    // Распознавание через Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const userText = transcription.text;

    if (!userText || !userText.trim()) {
      return res.json({ userText: '', text: '', audio: null });
    }

    // Обработка истории
    if (!userHistories.has(userId)) {
      userHistories.set(userId, []);
    }
    const history = userHistories.get(userId);

    history.push({ role: 'user', content: userText });
    if (history.length > 10) history.shift();

    // Генерация ответа от ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Ты — голосовой ассистент ARP. Отвечай кратко, емко и естественно, без лишней форматированной разметки и без списков, так как твой ответ будет озвучен.' },
        ...history
      ]
    });

    const assistantText = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: assistantText });

    // Озвучка через TTS
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