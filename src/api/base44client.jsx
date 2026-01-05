import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://supabasekong-aw0cg88kccwgg8c4skskccoc.46.202.154.237.sslip.io'
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
      const conversation = {
        id,
        agent_name,
        metadata,
        messages: [],
        created_at: new Date().toISOString()
      };
      base44.agents.conversations[id] = conversation;
      return conversation;
    },

    getConversation: async (id) => {
      return base44.agents.conversations[id] || null;
    },

    listConversations: async ({ agent_name }) => {
      return Object.values(base44.agents.conversations).filter(c => c.agent_name === agent_name);
    },

    addMessage: async (conversation, { role, content }) => {
      const id = typeof conversation === 'string' ? conversation : conversation.id;
      const conv = base44.agents.conversations[id];
      if (!conv) throw new Error('Conversation not found');

      const newMessage = {
        role,
        content,
        created_at: new Date().toISOString()
      };

      conv.messages.push(newMessage);

      // Trigger listeners
      if (base44.agents.listeners[id]) {
        base44.agents.listeners[id](conv);
      }

      // Smart Agent Logic (Simulated for Supabase)
      if (role === 'user') {
        setTimeout(async () => {
          let response = "";
          const lowerContent = content.toLowerCase();

          // Command: Add Lead
          if (content.includes("הוסף ליד") || content.includes("ליד חדש")) {
            const lines = content.split('\n');
            const data = {};
            lines.forEach(line => {
              if (line.includes("שם:")) data.customer_name = line.split("שם:")[1].trim();
              if (line.includes("טלפון:")) data.customer_phone = line.split("טלפון:")[1].trim();
              if (line.includes("כתובת:")) data.customer_address = line.split("כתובת:")[1].trim();
            });

            if (data.customer_name) {
              try {
                await base44.entities.Lead.create({
                  ...data,
                  status: "חדש",
                  source: "סוכן חכם"
                });
                response = `מעולה! הוספתי את ${data.customer_name} כליד חדש למערכת. ✅\nאפשר לראות אותו בדף הלידים.`;
              } catch (e) {
                response = "הייתה לי תקלה קטנה בשמירת הליד. וודא שכל הנתונים תקינים.";
              }
            } else {
              response = "בשמחה! רק תגיד לי איך קוראים לליד (למשל: 'שם: ישראל ישראלי').";
            }
          }
          // Command: List Leads / Customers
          else if (content.includes("תראה לי") || content.includes("רשימת") || content.includes("מי הלקוחות")) {
            const type = content.includes("ליד") ? "Lead" : "Customer";
            try {
              const items = await base44.entities[type].list();
              if (items && items.length > 0) {
                const names = items.slice(0, 5).map(i => i.customer_name || i.name || "שם לא ידוע").join(", ");
                response = `מצאתי ${items.length} ${type === "Lead" ? "לידים" : "לקוחות"}. הנה כמה מהם: ${names}${items.length > 5 ? ' ועוד...' : ''}`;
              } else {
                response = `חיפשתי, אבל נראה שעדיין אין ${type === "Lead" ? "לידים" : "לקוחות"} במערכת.`;
              }
            } catch (e) {
              response = "ניסיתי לבדוק את הנתונים אבל הייתה שגיאה טכנית קלה.";
            }
          }
          // Command: Add Job/Task
          else if (content.includes("משימה") || content.includes("תזכיר לי") || content.includes("עבודה")) {
            response = "אני יכול לעזור לך לנהל משימות! כרגע הדרך הכי טובה היא להוסיף אותן ישירות בדף המשימות, אבל בקרוב אוכל לעשות זאת בשבילך מכאן.";
          }
          // Default response
          else {
            const user = await base44.auth.me();
            response = `היי ${user.full_name}! אני הסוכן החכם של xFlow. 🤖\n\nאני יכול לעזור לך:\n🚀 **לפתוח לידים** (כתוב: "הוסף ליד שם: סמי")\n📊 **לראות נתונים** (כתוב: "מי הלקוחות שלי?")\n⚙️ **להגדיר את המערכת**\n\nמה תרצה שאעשה עכשיו?`;
          }

          conv.messages.push({
            role: "assistant",
            content: response,
            created_at: new Date().toISOString()
          });

          if (base44.agents.listeners[id]) {
            base44.agents.listeners[id](conv);
          }
        }, 1200);
      }

      return newMessage;
    },

    subscribeToConversation: (id, callback) => {
      base44.agents.listeners[id] = callback;
      // Return unsubscription function
      return () => {
        delete base44.agents.listeners[id];
      };
    }
  }
}
