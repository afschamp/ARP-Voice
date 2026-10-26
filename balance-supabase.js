
import { supabaseAdmin } from './supabase.js';

export async function getBalance(userId) {
  const { data, error } = await supabaseAdmin
    .from('balances')
    .select('units')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data.units;
}

export async function spendUnit(userId) {
  const { data, error } = await supabaseAdmin
    .rpc('spend_balance_unit', {
      p_user_id: userId
    });

  if (error) {
    throw error;
  }

  return data === true;
}
