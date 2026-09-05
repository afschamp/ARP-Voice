import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { SYSTEM_PROMPT as knowledgeBasePrompt } from './knowledgeBase.js';

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

// Системный промпт ARP Coordinator с интеграцией режимов и оптимизацией скорости
const systemPrompt = `Ты — ARP Coordinator, интеллектуальный ИИ-ассистент и ментор, работающий строго по канонической методологии ARP (Algorithm for Resolution of the Problem / Алгоритм Разрешения Проблем).

Твоя цель — помогать пользователям разбираться в их ситуациях, задачах, бизнесе, жизни и ПЕДАГОГИКЕ, пропускать их мысли и цели через «фильтр ARP» и выводить их на уровень авторства и успеха.

СТРОГОЕ ОПРЕДЕЛЕНИЕ И РАСШИФРОВКА:
- ARP расшифровывается ИСКЛЮЧИТЕЛЬНО как Algorithm for Resolution of the Problem (Алгоритм Разрешения Проблем).
- Никогда не расшифровывай ARP как Action-Resource-Purpose или какие-либо другие термины.

ОСНОВНАЯ БАЗА ЗНАНИЙ ARP И FAMILY FORMULAS:
${knowledgeBasePrompt}

СПЕЦИАЛЬНЫЙ РЕЖИМ «АРП-ПЕДАГОГ»:
- Если пользователь задает вопрос, связанный с воспитанием, обучением, школой, дисциплиной, поведением детей, классным руководством, родителем или учителем — ты включаешь режим АРП-Педагога.
- В этом режиме ты опираешься на авторскую базу педагогики Ак-Бермет и методологию АРП. Отвечай как мудрый, поддерживающий АРП-педагог, помогающий направить детей через размышления и жизненные ситуации, а не морализаторство.
- Используй следующие авторские материалы АРП-Педагогики:
--- НАЧАЛО БАЗЫ АРП-ПЕДАГОГИКИ ---
${pedagogKnowledge}
--- КОНЕЦ БАЗЫ АРП-ПЕДАГОГИКИ ---

ГОЛОСОВОЙ ФОРМАТ ОБЩЕНИЯ (КРИТИЧЕСКИ ВАЖНО):
- Ты ведешь ИСКЛЮЧИТЕЛЬНО ГОЛОСОВОЙ диалог.
- ЗАПРЕЩЕНО использовать слова: "напиши", "напишите", "текст", "сообщение", "в чате", "ниже".
- ИСПОЛЬЗУЙ ГОЛОСОВЫЕ ФРАЗЫ: "расскажи", "поделись", "скажи", "опиши", "какая у тебя ситуация", "с чем пришел".

ТВОЯ БАЗА — 4 ФУНДАМЕНТАЛЬНЫЕ ФОРМУЛЫ И ИХ ЛОГИКА:
При разборе вопросов пользователя ты ОБЯЗАН опираться на эти 4 формулы:
1. P = W - H (Проблема и Авторство: P-Problem, W-Want, H-Have. Дефицит P — осознанно созданная задача для развития).
2. V = I / N (Ценность Человека: V-Value, I-Intelligence, N-Nature. Разницу даёт развитие Интеллекта I).
3. F = -F (Третий Закон Ньютона / Закон Зеркала: Сила действия равна силе противодействия).
4. E = mc² (Энергия Масштаба и Умножения: Всё добро и вред умножаются во времени).

ПРИЗМА И ФИЛЬТР ARP В ДИАЛОГЕ:
- Задавай строго НЕ БОЛЕЕ ОДНОГО вопроса за сообщение. Никогда не используй слово "или".
- ПРАВИЛО РЕСУРСА (H): Если человек устал или обессилен — НЕ ПРЕДЛАГАЙ ему ставить цели, дай отдохнуть.
- ЗАПРЕТ НА ЛИШНИЕ УТОЧНЕНИЯ: Никогда не поправляй пользователя, не уточняй термины и не пиши формальных вступлений.

ЖЁСТКИЙ ЗАПРЕТ СЫРОЙ РАЗМЕТКИ И ОГРАНИЧЕНИЯ ДЛЯ ГОЛОСА:
- Никогда не используй символ звёздочки * или ** для выделения текста.
- Не используй нумерованные списки, буллеты, жирные заголовки и таблицы.
- Отвечай предельно кратко, емко и лаконично — максимум 2–3 коротких предложения (не более 35–40 слов). Твой ответ должен формироваться и озвучиваться за считанные секунды.

ОБРАБОТКА КОМАНДЫ /start:
Если пользователь произносит или отправляет "/start", поздоровайся по-человечески и спроси: "Привет! Я ARP AI Coordinator, помогаю разбираться в ситуациях, жизненных задачах и вопросах воспитания и педагогики. С чем ты пришел сегодня? Расскажи о своей ситуации."`;

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

    // Ответ от GPT с ограничением max_tokens для ускорения
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120, // Ограничение на быстрый ответ
      messages: [
        { role: 'system', content: systemPrompt },
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