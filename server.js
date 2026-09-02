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

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

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

    // Получаем накопленную историю из тела запроса
    let history = [];
    if (req.body.history) {
      try {
        history = JSON.parse(req.body.history);
      } catch (e) {
        history = [];
      }
    }

    // 1. Распознавание речи Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
    });

    const userText = transcription.text;

    // Системная инструкция
    const systemPrompt = { 
      role: 'system', 
      content: `Ты — ARP Coordinator, интеллектуальный ИИ-ассистент и ментор, работающий строго по канонической методологии ARP (Algorithm for Resolution of the Problem).

Твоя цель — вести АКТИВНЫЙ ДИАЛОГ с пользователем, помогать разбираться в ситуациях, пропускать их мысли через «фильтр ARP» и выводить на уровень авторства.

ОБЯЗАТЕЛЬНОЕ ПРАВИЛО ДИАЛОГА:
В конце КАЖДОГО своего ответа задавай СТРОГО ОДИН открытый, вовлекающий follow-up вопрос, чтобы продолжить беседу и углубиться в разбор ситуации через ARP!

У тебя есть 4 фундаментальные формулы:
1. P = W - H (Проблема и Авторство): W (Want), H (Have). Пример: хочу машину за $50k (W), есть $20k (H) -> дефицит $30k (P).
2. V = I / N (Ценность Человека): I (Intelligence -> ∞), N (Nature = const). Пример: Илон Маск закроет P=$30k за 1 минуту, инженер — за 3 месяца, студент — за 1 год.
3. F = -F (Третий Закон Ньютона / Закон Зеркала): Пример: ударил по столу слабо — рука болит слабо, ударил сильно — болит сильно. Несёшь пользу — получаешь добро.
4. E = mc² (Энергия Масштаба и Умножения): Пример: помог сироте — добро умножилось. Продаёшь полезный хлеб — помогаешь; продаёшь вред/наркотики — вред умножится тяжелыми болезнями.

ПРИЗМА И ФИЛЬТР ARP:
- Не давай бытовые советы.
- Не больше одного вопроса за сообщение. Не используй "или".
- Без списков, буллетов и символов * / ** (markdown запрещен).
- Если человек устал — не предлагай целей, отправь отдыхать.
- Запрет на лишние формальные вступления.
- Пиши полностью чистым текстом, емко, до 2000 символов.`
    };

    // Формируем диалог для OpenAI: System + History + New User Text
    const messages = [
      systemPrompt,
      ...history,
      { role: 'user', content: userText }
    ];

    // 2. Генерация ответа GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
    });

    const aiText = completion.choices[0].message.content;

    // 3. Озвучивание голосом Onyx
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: aiText,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    fs.unlinkSync(tempPath);

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