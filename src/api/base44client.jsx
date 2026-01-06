import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fnxaeyqddkrmvmigaiul.supabase.co'
const supabaseAnonKey = 'sb_publishable_LwmD75OxWNrKXrec6IPYxA_Egx6R8He'

// Critical: Singleton with forced storage key
if (!window.__supabase) {
  window.__supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'xflow-auth-storage-v2'
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

        // Secondary check via session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return { id: session.user.id, email: session.user.email, ...session.user.user_metadata };

        throw new Error('Not authenticated');
      } catch (e) {
        console.error("Auth me error:", e);
        throw e;
      }
    },
    signInWithPassword: async ({ email, password }) => {
      console.log("Attempting direct fetch login...");
      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();
      if (!res.ok) {
        let msg = json.error_description || json.error || 'שגיאת התחברות';
        if (msg === 'Invalid login credentials') msg = 'אימייל או סיסמה שגויים';
        throw new Error(msg);
      }

      console.log("Login success, syncing session...");

      // We perform setSession but we don't let it block indefinitely
      try {
        const sessionPromise = supabase.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token
        });

        // Timeout session sync after 2 seconds
        await Promise.race([
          sessionPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]).catch(e => console.warn("Session sync timed out or failed, but login is valid."));

      } catch (e) {
        console.warn("Silent session sync failure:", e);
      }

      return { data: json, error: null };
    },
    logout: async () => {
      await supabase.auth.signOut().catch(() => { });
      localStorage.clear();
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
            if (error) throw error
            return data || []
          } catch (e) {
            console.error(`List error for ${tableName}:`, e);
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
  }),
  agents: {
    conversations: {},
    listeners: {},
    createConversation: async () => ({ id: Math.random() }),
    addMessage: async () => ({})
  }
}
