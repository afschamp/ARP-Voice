
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './knowledgeBase.js';
import { getBalance, spendUnit } from './balance-supabase.js';
import { requireAuth } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadKnowledgeFile(filename) {
  try {
    const filePath = path.join(__dirname, filename);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`База ${filename} загружена`);
      return content;
    }

    console.warn(`Файл ${filename} не найден`);
  } catch (error) {
    console.error(
      `Ошибка загрузки ${filename}:`,
      error.message
    );
  }

  return '';
}

const pedagogKnowledge = loadKnowledgeFile('arp-pedagog.txt');
const schoolKnowledge = loadKnowledgeFile('arp-school.txt');
const studentKnowledge = loadKnowledgeFile('arp-student.txt');

const app = express();

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const userHistories = new Map();
const activeRequests = new Set();

const fullSystemPrompt = `${SYSTEM_PROMPT}

==================================================
ГЛАВНЫЕ ПРАВИЛА РАБОТЫ ГОЛОСОВОГО АРП
==================================================

АРП — Алгоритм разрешения проблем.

Ты интеллектуальный помощник учителя,
а также собеседник для родителей, детей
и взрослых людей.

Твоя задача — помогать людям осмысленно
решать проблемы, развивать характер,
ответственность, самостоятельность
и другие человеческие качества.

Сам определяй нужный формат ответа.

--------------------------------------------------
РЕЖИМ 1. ОБЫЧНЫЙ РАЗГОВОР
--------------------------------------------------

Если пользователь задаёт обычный вопрос,
просит объяснение, совет или обсуждает
жизненную ситуацию:

- Отвечай естественно и по существу.
- Обычно используй 2–5 небольших абзацев.
- Не превращай ответ в конспект урока.
- Не создавай автоматически заголовки
  занятий, цели, упражнения и домашние задания.
- Используй формулы АРП, когда они помогают.
- Приводи понятные жизненные примеры.
- При необходимости задавай один вопрос.
- Не повторяй одну мысль много раз.

Если пользователь спрашивает
"Что такое АРП?", дай краткое объяснение,
а не учебную лекцию.

--------------------------------------------------
РЕЖИМ 2. ПОМОЩНИК УЧИТЕЛЯ
--------------------------------------------------

Если пользователь просит подготовить урок,
классный час, конспект, тренинг, занятие,
методическую разработку или программу:

Создавай полноценный практический материал,
которым учитель сможет пользоваться.

Учитывай:
- тему занятия;
- возраст учеников;
- класс;
- продолжительность;
- цели учителя;
- условия проведения.

Если время не указано, используй 45 минут
как рабочее предположение и сообщай об этом.

Для подробного урока используй структуру:

1. Название темы.
2. Возраст или класс учеников.
3. Продолжительность занятия.
4. Цель и ожидаемые результаты.
5. Главная идея урока.
6. Подходящие формулы АРП.
7. Интересное вступление.
8. Объяснение темы.
9. Жизненные ситуации.
10. Вопросы для обсуждения.
11. Практические упражнения и игры.
12. Небольшой эксперимент АРП.
13. Подведение итогов.
14. Рефлексия учеников.
15. Домашнее задание при необходимости.
16. Рекомендации учителю.

Распределяй время по этапам урока.
Подбирай задания с учётом возраста.
Используй базу знаний и философию АРП.
Не добавляй упражнения ради объёма.

Если просят краткий план, дай краткий план.
Если просят подробный конспект,
подготовь подробный конспект.

--------------------------------------------------
РЕЖИМ 3. ОБУЧЕНИЕ САМОМУ АРП
--------------------------------------------------

Если пользователь просит:
"Научи меня АРП",
"Как пользоваться формулами АРП?"
или хочет освоить методику:

- Объясняй материал постепенно.
- Начинай с простых формул и ситуаций.
- Предлагай маленькие жизненные эксперименты.
- Проверяй понимание короткими вопросами.
- Помогай применять АРП самостоятельно.

Не выдавай сразу огромную лекцию.

--------------------------------------------------
ОСНОВНЫЕ ПРИНЦИПЫ
--------------------------------------------------

Формула проблемы:

Проблема — это разница между тем,
чего человек хочет, и тем, что он имеет.

Принцип действия и противодействия:

Поступки человека вызывают ответную
реакцию окружающих. Помогай осмысливать
последствия собственных действий.

Принцип чувства меры:

Стремясь к успеху, человек не должен
жертвовать здоровьем, близкими,
детьми и уже имеющимся счастьем.

Принцип "Не поверь — проверь":

Помогай человеку проверять полезные идеи
через небольшие жизненные эксперименты.

Высшая цель АРП — не давать человеку
готовые решения, а научить его
обходиться без подсказок.

--------------------------------------------------
ВАЖНОЕ ПРАВИЛО ПРИОРИТЕТА
--------------------------------------------------

Эти правила определяют ФОРМАТ ответа.

Шаблоны учебных конспектов из баз знаний
применяй только тогда, когда пользователь
действительно просит учебный материал.

Обычный вопрос не является просьбой
создать урок.

==================================================
ДОПОЛНИТЕЛЬНАЯ БАЗА ЗНАНИЙ: ШКОЛЬНЫЙ ЭТАП
==================================================

${schoolKnowledge}

==================================================
ДОПОЛНИТЕЛЬНАЯ БАЗА ЗНАНИЙ: СТУДЕНЧЕСКИЙ ЭТАП
==================================================

${studentKnowledge}

==================================================
ДОПОЛНИТЕЛЬНАЯ БАЗА ЗНАНИЙ: АРП-ПЕДАГОГ
==================================================

Если пользователь спрашивает о воспитании,
школе, дисциплине, поведении детей,
учителях или родителях, используй
методику АРП-педагогики.

${pedagogKnowledge}

==================================================
КОНЕЦ БАЗЫ ЗНАНИЙ
==================================================
`;

function prepareTtsText(text) {
  if (!text) return '';

  if (text.length <= 3500) {
    return text;
  }

  return text.slice(0, 3500) +
    '... Полный текст конспекта выведен на экран.';
}

// Баланс только авторизованного пользователя
app.get('/api/balance/:userId', requireAuth, async (req, res) => {
  if (req.params.userId !== req.userId) {
    return res.status(403).json({
      error: 'Нет доступа к чужому балансу'
    });
  }

  try {
    res.json({
      balance: await getBalance(req.userId)
    });
  } catch (error) {
    console.error('Ошибка получения баланса:', error);

    res.status(503).json({
      error: 'Баланс временно недоступен'
    });
  }
});

// История разговора текущего пользователя
app.get('/api/history/:userId', requireAuth, (req, res) => {
  if (req.params.userId !== req.userId) {
    return res.status(403).json({
      error: 'Нет доступа к чужой истории'
    });
  }

  res.json({
    history: userHistories.get(req.userId) || []
  });
});

// Основной голосовой запрос
app.post(
  '/api/voice',
  requireAuth,
  upload.single('audio'),
  async (req, res) => {
    const filePath = req.file?.path;
    const userId = req.userId;
    const userLang = req.body?.language || 'ru';
    let locked = false;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'Аудиофайл не передан'
        });
      }

      if (await getBalance(userId) < 1) {
        return res.status(402).json({
          error: 'Единицы закончились',
          balance: 0
        });
      }

      if (activeRequests.has(userId)) {
        return res.status(409).json({
          error: 'Предыдущий запрос ещё обрабатывается',
          balance: await getBalance(userId)
        });
      }

      activeRequests.add(userId);
      locked = true;

      // Распознавание речи
      const fileBuffer = fs.readFileSync(filePath);

      const audioFile = await OpenAI.toFile(
        fileBuffer,
        'recording.webm',
        { type: 'audio/webm' }
      );

      const transcription =
        await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: userLang
        });

      const userText =
        (transcription.text || '').trim();

      // Пустая запись не списывает единицы
      if (!userText) {
        return res.json({
          userText: '',
          text: '',
          audio: null,
          balance: await getBalance(userId)
        });
      }

      const oldHistory =
        userHistories.get(userId) || [];

      const languageInstruction = (userLang === 'en')
        ? "IMPORTANT: Respond strictly in English. Follow the 6-step ARP framework."
        : "ВАЖНО: Отвечай строго на русском языке. Следуй 6-шаговому фреймворку ARP.";

      // Генерация ответа
      const completion =
        await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 4096,
          messages: [
            {
              role: 'system',
              content: `${fullSystemPrompt}\n\n${languageInstruction}`
            },
            ...oldHistory,
            {
              role: 'user',
              content: userText
            }
          ]
        });

      const assistantText =
        completion.choices[0]?.message?.content || '';

      if (!assistantText.trim()) {
        throw new Error(
          'OpenAI вернул пустой ответ'
        );
      }

      // Озвучивание ответа
      let base64Audio = null;

      try {
        const mp3 =
          await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy',
            input: prepareTtsText(assistantText)
          });

        base64Audio = Buffer.from(
          await mp3.arrayBuffer()
        ).toString('base64');

      } catch (ttsError) {
        console.error(
          'Ошибка озвучки:',
          ttsError.message
        );
      }

      // Списание после успешного ответа
      if (!(await spendUnit(userId))) {
        return res.status(402).json({
          error: 'Единицы закончились',
          balance: await getBalance(userId)
        });
      }

      const nextHistory = [
        ...oldHistory,
        {
          role: 'user',
          content: userText
        },
        {
          role: 'assistant',
          content: assistantText
        }
      ].slice(-20);

      userHistories.set(
        userId,
        nextHistory
      );

      res.json({
        userText,
        text: assistantText,
        audio: base64Audio,
        balance: await getBalance(userId)
      });

    } catch (error) {
      console.error(
        'Ошибка голосового запроса:',
        error.status || '',
        error.message
      );

      res.status(500).json({
        error: 'Ошибка обработки запроса'
      });

    } finally {
      if (locked) {
        activeRequests.delete(userId);
      }

      if (filePath) {
        fs.unlink(filePath, () => {});
      }
    }
  }
);

// Повторная озвучка
app.post('/api/tts', requireAuth, async (req, res) => {
  const { text } = req.body || {};
  const userId = req.userId;

  if (
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > 10000
  ) {
    return res.status(400).json({
      error: 'Неверный текст'
    });
  }

  if (activeRequests.has(userId)) {
    return res.status(409).json({
      error: 'Предыдущий запрос ещё обрабатывается'
    });
  }

  activeRequests.add(userId);

  try {
    const balance = await getBalance(userId);

    if (balance < 1) {
      return res.status(402).json({
        error: 'Единицы закончились',
        balance
      });
    }

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: prepareTtsText(text)
    });

    const audio = Buffer.from(
      await mp3.arrayBuffer()
    ).toString('base64');

    // Списание только после успешного озвучивания
    if (!(await spendUnit(userId))) {
      return res.status(402).json({
        error: 'Единицы закончились',
        balance: await getBalance(userId)
      });
    }

    return res.json({
      audio,
      balance: await getBalance(userId)
    });

  } catch (error) {
    console.error(
      'Ошибка TTS:',
      error.status || '',
      error.message
    );

    return res.status(500).json({
      error: 'Ошибка генерации озвучки'
    });

  } finally {
    activeRequests.delete(userId);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
