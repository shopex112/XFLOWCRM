import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://supabasekong-aw0cg88kccwgg8c4skskccoc.46.202.154.237.sslip.io'
const supabaseAnonKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzY0NjE0MCwiZXhwIjo0OTIzMzE5NzQwLCJyb2xlIjoiYW5vbiJ9.WhtAxKc_QjHXmUt9OS_Tv3-3zy2xSXzBWsDwNaDvhog'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Compatibility Layer for Base44 to Supabase migration.
 * This object mimics the Base44 SDK structure to minimize UI changes.
 */
export const base44 = {
  supabase,
  auth: {
    me: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) throw new Error('Not authenticated')

      // Map Supabase user to Base44 user structure
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
      const { data: { user }, error } = await supabase.auth.updateUser({
        data: data
      })
      if (error) throw error
      return user
    },
    logout: async () => {
      await supabase.auth.signOut()
      window.location.reload()
    }
  },

  functions: new Proxy({}, {
    get: (target, name) => {
      return async () => {
        console.warn(`Function base44.functions.${name} is not implemented in Supabase yet.`);
        return { success: true, message: 'Stubbed' };
      }
    }
  }),

  entities: new Proxy({}, {
    get: (target, entityName) => {
      // Map Base44 entity names to Supabase table names (lowercase)
      const tableName = entityName.toLowerCase()

      return {
        list: async (query = {}) => {
          let request = supabase.from(tableName).select('*')
          // Add basic filtering if needed
          const { data, error } = await request
          if (error) {
            console.error(`Error fetching ${tableName}:`, error)
            return []
          }
          return data
        },
        get: async (id) => {
          const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single()
          if (error) throw error
          return data
        },
        create: async (data) => {
          const { data: result, error } = await supabase.from(tableName).insert([data]).select().single()
          if (error) throw error
          return result
        },
        update: async (id, data) => {
          const { data: result, error } = await supabase.from(tableName).update(data).eq('id', id).select().single()
          if (error) throw error
          return result
