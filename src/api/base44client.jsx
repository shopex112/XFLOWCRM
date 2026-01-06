import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fnxaeyqddkrmvmigaiul.supabase.co'
const supabaseAnonKey = 'sb_publishable_LwmD75OxWNrKXrec6IPYxA_Egx6R8He'

// Global singleton to prevent "Multiple GoTrueClient instances" error
if (!window.__supabase) {
  window.__supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'xflow-auth-storage'
    }
  });
}

export const supabase = window.__supabase;

export const base44 = {
  supabase,
  auth: {
    me: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) throw new Error('Not authenticated')
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email.split('@')[0],
        role: user.user_metadata?.role || 'admin',
        role_type: user.user_metadata?.role_type || 'מנהל',
        ...user.user_metadata
      }
    },
    signInWithPassword: async ({ email, password }) => {
      // Direct fetch to verify credentials first - very fast, no SDK overhead
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

      // Sync the session to the SDK
      await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token
      });

      return { data: json, error: null };
    },
    logout: async () => {
      await supabase.auth.signOut()
      localStorage.clear()
      window.location.href = '/'
    }
  },
  entities: new Proxy({}, {
    get: (target, entityName) => {
      if (typeof entityName === 'symbol') return target[entityName]
      const tableName = entityName.toLowerCase()
      return {
        list: async (queryOrSort = {}) => {
          let request = supabase.from(tableName).select('*')
          if (typeof queryOrSort === 'string') {
            const isDesc = queryOrSort.startsWith('-')
            const column = isDesc ? queryOrSort.substring(1) : queryOrSort
            request = request.order(column, { ascending: !isDesc })
          }
          const { data, error } = await request
          return data || []
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
      return async () => {
        console.warn(`Function base44.functions.${name} not implemented.`);
        return { success: true };
      }
    }
  }),
  agents: {
    conversations: {},
    listeners: {},
    createConversation: async () => ({ id: Math.random() }),
    addMessage: async () => ({})
  }
}
