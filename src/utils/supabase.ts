import { createClient } from '@supabase/supabase-js';

// פרויקט ה-Supabase הייעודי של יובל (חשבון נפרד, בידוד מלא מהרוש/שלי).
const SUPABASE_URL = 'https://tfjptyzpculbuoviunea.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmanB0eXpwY3VsYnVvdml1bmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mjk2ODYsImV4cCI6MjA5NzIwNTY4Nn0.jXjHG1AjxKEaiqyKLjwy5UX0vYZp1kMf7VwhnVW891A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
