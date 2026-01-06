import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fnxaeyqddkrmvmigaiul.supabase.co'
const supabaseAnonKey = 'sb_publishable_LwmD75OxWNrKXrec6IPYxA_Egx6R8He'

// Use a unique storage key to avoid conflicts with previous local installs
const STORAGE_KEY = 'xflow-v3-auth';

if (!window.__supabase) {
  window.__supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY
    }
  });
}

export const supabase = window.__supabase;

export const base44 = {
  supabase,
  auth: {
    me: async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (user) return {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email.split('@')[0],
          role: user.user_metadata?.role || 'admin',
          role_type: user.user_metadata?.role_type || 'מנהל',
          ...user.user_metadata
        }

        // Try fallback via session if getUser hangs or fails
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return {
          id: session.user.id,
          email: session.user.email,
          ...session.user.user_metadata
        };

        throw new Error('Not authenticated');
      } catch (e) {
        console.error("Auth check failed:", e);
        throw e;
      }
    },
    signInWithPassword: async ({ email, password }) => {
      console.log(`[Auth] Attempting login for: ${email}`);

      try {
        // Use the standard SDK first, it's more reliable for session persistence
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          console.warn("[Auth] SDK login failed, trying direct fetch bypass...", error.message);

          // Bypass: Direct fetch if SDK is problematic
          const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': supabaseAnonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });

          const json = await res.json();
          if (!res.ok) {
            let msg = json.error_description || json.error || 'שגיאת התחברות';
            if (msg.includes('invalid_credentials')) msg = 'אימייל או סיסמה שגויים';
            if (msg.includes('Email not confirmed')) msg = 'יש לאשר את האימייל בתיבת הדואר';
            throw new Error(msg);
          }

          // Force sync the session manually
          await supabase.auth.setSession({
            access_token: json.access_token,
            refresh_token: json.refresh_token
          });

          return { data: json, error: null };
        }

        return { data, error: null };
      } catch (e) {
        console.error("[Auth] Login error:", e.message);
        throw e;
      }
    },
    logout: async () => {
      await supabase.auth.signOut().catch(() => { });
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = '/';
    }
  },
  entities: new Proxy({}, {
    get: (target, entityName) => {
      if (typeof entityName === 'symbol') return target[entityName]
      const tableName = entityName.toLowerCase()
      return {
        list: async (queryOrSort = {}) => {
          try {
            let request = supabase.from(tableName).select('*')
            if (typeof queryOrSort === 'string') {
              const isDesc = queryOrSort.startsWith('-')
              const column = isDesc ? queryOrSort.substring(1) : queryOrSort
              request = request.order(column, { ascending: !isDesc })
            }
            const { data, error } = await request
            return data || []
          } catch (e) {
            return [];
          }
        },
        create: async (data) => {
          const { data: res, error } = await supabase.from(tableName).insert([data]).select().single()
          if (error) throw error
          return res
        },
        update: async (id, data) => {
          const { data: res, error } = await supabase.from(tableName).update(data).eq('id', id).select().single()
          if (error) throw error
          return res
        },
        delete: async (id) => {
          await supabase.from(tableName).delete().eq('id', id)
          return true
        }
      }
    }
  }),
  functions: new Proxy({}, {
    get: (target, name) => {
      return async () => ({ success: true });
    }
  })
}
