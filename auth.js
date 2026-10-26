
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error('Supabase Auth configuration is missing');
}

const supabaseAuth = createClient(
  supabaseUrl,
  publishableKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      error: 'Требуется вход в аккаунт'
    });
  }

  try {
    const { data, error } =
      await supabaseAuth.auth.getUser(match[1]);

    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Недействительная сессия'
      });
    }

    req.userId = data.user.id;
    next();
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error.message);

    return res.status(503).json({
      error: 'Не удалось проверить авторизацию'
    });
  }
}
