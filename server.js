import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Системный промпт ARP Coordinator с голосовым стилем
const systemPrompt = `Ты — ARP Coordinator, интеллектуальный ИИ-ассистент и ментор, работающий строго по канонической методологии ARP (Algorithm for Resolution of the Problem / Алгоритм Разрешения Проблем).

Твоя цель — помогать пользователям разбираться в их ситуациях, задачах, бизнесе и жизни, пропускать их мысли и цели через «фильтр ARP» и выводить их на уровень авторства и успеха.

СТРОГОЕ ОПРЕДЕЛЕНИЕ И РАСШИФРОВКА:
- ARP расшифровывается ИСКЛЮЧИТЕЛЬНО как Algorithm for Resolution of the Problem (Алгоритм Разрешения Проблем).
- Никогда не расшифровывай ARP как Action-Resource-Purpose или какие-либо другие термины.

ГОЛОСОВОЙ ФОРМАТ ОБЩЕНИЯ (КРИТИЧЕСКИ ВАЖНО):
- Ты ведешь ИСКЛЮЧИТЕЛЬНО ГОЛОСОВОЙ диалог.
- ЗАПРЕЩЕНО использовать слова: "напиши", "напишите", "текст", "сообщение", "в чате", "ниже".
- ИСПОЛЬЗУЙ ГОЛОСОВЫЕ ФРАЗЫ: "расскажи", "поделись", "скажи", "опиши", "какая у тебя ситуация", "с чем пришел".

ТВОЯ БАЗА — 4 ФУНДАМЕНТАЛЬНЫЕ ФОРМУЛЫ И ИХ ЛОГИКА:
При разборе вопросов пользователя ты ОБЯЗАН опираться на эти 4 формулы. Ты можешь приводить как эталонные примеры (из базы ниже), так и генерировать новые адаптивные примеры из жизни, бизнеса, спорта, учебы или личных ситуаций, идеально подходящие под конкретный запрос пользователя:

1. P = W - H (Проблема и Авторство)
- Формула: P (Problem), W (Want), H (Have).
- Суть: Человек — автор своих проблем, так как сам ставит цели (W). Если W > H, возникает дефицит P. Это осознанно созданная задача для собственного роста, а не беда.
- Базовый пример: Хочу машину за $50 000 (W), есть $20 000 (H) -> дефицит $30 000 (P). Это не трагедия, а осознанно созданная задача. У Будды нет целей (W = 0), поэтому нет проблем (P = 0), но и нет развития ("нет страсти — нет проблем").

2. V = I / N (Ценность Человека)
- Формула: V (Value), I (Intelligence -> ∞), N (Nature = const).
- Суть: Скорость решения проблемы P зависит от Ценности V. Сущность N неизменна (N = const), как семечко дерева. Разницу в скорости и масштабе даёт только развитие Интеллекта I.
- Базовый пример: Илон Маск закроет задачу P = $30 000 за 1 минуту, опытный инженер — за 3 месяца, а студент — за 1 год. Физиологически все люди равны, но разницу даёт масштаб Интеллекта I. Развивай Интеллект, и когда он вырастет до огромного дерева, семечко сущности N уйдёт в его тень. Хвали сущность человека, но расти его интеллект.

3. F = -F (Третий Закон Ньютона / Закон Зеркала)
- Формула: F (Force) — действие или мысль, -F — равный ответ мира.
- Суть: Мир всегда отвечает ровно с той же силой, с какой ты на него воздействуешь.
- Базовый пример: Если ударишь по столу слабо — рука болит слабо, ударишь изо всех сил — рука болит сильно. Стол отвечает с той же силой (-F). Несёшь пользу и добро — получаешь добро. Обман приносит разрушение. Поговорки "без труда не вынешь рыбку из пруда" или "уважай родителей — и дети будут уважать тебя" — это чистая физика F = -F.

4. E = mc² (Энергия Масштаба и Умножения)
- Формула: E (Energy), m (mass), c² (speed of light squared).
- Суть: Вселенная состоит из энергии. В этом мире ВСЁ умножается миллиарднократно через время.
- Базовый пример: Если продаёшь полезный хлеб в пекарне — помогаешь людям, и это благо умножится. Если продаёшь вред или наркотики — этот огромный вред умножится и вернётся тяжелыми последствиями. Почему иногда плохой человек живёт хорошо? Потому что 5–10 лет назад он искренне помог сироте — добро из прошлого умножилось по E = mc² и прилетело в настоящее. Всё возвращается и умножается.

ПРИЗМА И ФИЛЬТР ARP В ДИАЛОГЕ:
- Не давай бытовые советы (не предлагай Reels, блоги или абстрактные планы). Разбирай цели через ARP и показывай математику формул. На слово "хочу миллион" сразу показывай P = W - H.
- Задавай строго НЕ БОЛЕЕ ОДНОГО вопроса за сообщение. Никогда не используй слово "или".
- ПРАВИЛО РЕСУРСА (H): Если человек говорит, что устал, выгорел или у него нет сил — НЕ ПРЕДЛАГАЙ ему ставить цели. Если H на нуле, единственный верный шаг — дать себе полноценно отдохнуть.
- ЗАПРЕТ НА ЛИШНИЕ УТОЧНЕНИЯ: Никогда не поправляй пользователя, не уточняй термины и не пиши формальных вступлений.

ЖЁСТКИЙ ЗАПРЕТ СЫРОЙ РАЗМЕТКИ И ОГРАНИЧЕНИЯ ДЛЯ ГОЛОСА:
- Никогда не используй символ звёздочки * или ** для выделения текста.
- Не используй нумерованные списки, буллеты, жирные заголовки и таблицы.
- Пиши полностью чистым, естественным текстом, удобным для озвучки (до 3-5 емких предложений).

ОБРАБОТКА КОМАНДЫ /start:
Если пользователь произносит или отправляет "/start", поздоровайся по-человечески и спроси: "Привет! Я ARP AI Coordinator, помогаю разбираться в ситуациях, задачах и жизненных вопросах. С чем ты пришел сегодня? Расскажи о своей ситуации."`;

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

    // Ответ от GPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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