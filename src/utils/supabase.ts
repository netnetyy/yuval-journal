import { createClient } from '@supabase/supabase-js';

// TODO(יובל): להחליף בפרטי פרויקט ה-Supabase החדש של יובל (URL + anon key).
// עד שיוחלפו — הסנכרון לענן נכשל בשקט והאפליקציה עובדת מקומית (localStorage).
const SUPABASE_URL = 'https://YUVAL_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YUVAL_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
