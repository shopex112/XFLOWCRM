import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fnxaeyqddkrmvmigaiul.supabase.co'
const supabaseAnonKey = 'sb_publishable_LwmD75OxWNrKXrec6IPYxA_Egx6R8He'

// Singleton pattern to prevent multiple client instances
let supabaseInstance = null;
if (typeof window !== 'undefined' && window.__supabase) {
  supabaseInstance = window.__supabase;
} else {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'sb-fnxaeyqddkrmvmigaiul-auth-token'
    }
  });
  if (typeof window !== 'undefined') {
    window.__supabase = supabaseInstance;
  }
}

export const supabase = supabaseInstance;

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
    updateMe: async (data) => {
      const { data: { user }, error } = await supabase.auth.updateUser({ data })
      if (error) throw error
      return user
    },
    signInWithPassword: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return { data, error: null }
    },
    logout: async () => {
      await supabase.auth.signOut()
      window.location.href = '/'
    }
  },

  storage: {
    upload: async (file, bucket = 'logos') => {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return publicUrl;
    }
  },

  functions: new Proxy({}, {
    get: (target, name) => {
      return async () => {
        console.warn(`Function base44.functions.${name} is not implemented.`);
        return { success: true };
      }
    }
  }),

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
            if (error) {
              console.warn(`Table ${tableName} error:`, error.message)
              return []
            }
            return data || []
          } catch (e) {
            console.warn(`List ${tableName} failed:`, e)
            return []
          }
        },
        filter: async (filters = {}) => {
          try {
            let request = supabase.from(tableName).select('*')
            Object.entries(filters).forEach(([key, value]) => {
              request = request.eq(key, value)
            })
            const { data, error } = await request
            if (error) return []
            return data || []
          } catch (e) {
            return []
          }
        },
        get: async (id) => {
          const { data, error } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle()
          if (error) return null
          return data
        },
        create: async (data) => {
          const { data: result, error } = await supabase.from(tableName).insert([data]).select().single()
          if (error) throw error
          return result
        },
        update: async (id, data) => {
          // Uses upsert to robustly handle missing records (e.g. for initial admin user)
          const { data: result, error } = await supabase.from(tableName).upsert({ ...data, id }).select().single()
          if (error) throw error
          return result
        },
        delete: async (id) => {
          const { error } = await supabase.from(tableName).delete().eq('id', id)
          if (error) throw error
          return true
        }
      }
    }
  }),

  agents: {
    conversations: {},
    listeners: {},
    createConversation: async ({ agent_name, metadata }) => {
      const id = Math.random().toString(36).substring(7);
      const conversation = { id, agent_name, metadata, messages: [], created_at: new Date().toISOString() };
      base44.agents.conversations[id] = conversation;
      return conversation;
    },
    getConversation: async (id) => base44.agents.conversations[id] || null,
    listConversations: async ({ agent_name }) => Object.values(base44.agents.conversations).filter(c => c.agent_name === agent_name),
    addMessage: async (conversation, { role, content }) => {
      const id = typeof conversation === 'string' ? conversation : conversation.id;
      const conv = base44.agents.conversations[id];
      if (!conv) throw new Error('Conversation not found');
      const newMessage = { role, content, created_at: new Date().toISOString() };
      conv.messages.push(newMessage);
      if (base44.agents.listeners[id]) base44.agents.listeners[id](conv);
      return newMessage;
    },
    subscribeToConversation: (id, callback) => {
      base44.agents.listeners[id] = callback;
      return () => { delete base44.agents.listeners[id]; };
    }
  }
}
