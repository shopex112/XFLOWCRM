
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// The Input component is replaced by a textarea for expanding functionality.
// import { Input } from "@/components/ui/input"; 
import { motion } from "framer-motion";
import { Loader2, MessageCircle, Send, Bot, User as UserIcon, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Setup() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef(null); // Added useRef for auto-scrolling

  useEffect(() => {
    initSetup();
  }, []);

  const initSetup = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.setup_completed) {
        navigate(createPageUrl("Dashboard"));
        return;
      }
      
      // נסה ליצור שיחה עם הבוט
      try {
        const newConv = await base44.agents.createConversation({
          agent_name: "crm_setup_assistant",
          metadata: {
            name: "התקנה ראשונית",
            user_id: currentUser.id
          }
        });
        
        setConversation(newConv);
        
        // שלח הודעת פתיחה
        setTimeout(async () => {
          try {
            await base44.agents.addMessage(newConv, {
              role: "user",
              content: "שלום! אני רוצה להתחיל להגדיר את המערכת שלי. תוכל לעזור לי?"
            });
          } catch (err) {
            console.log("First message error:", err);
          }
        }, 1000);
        
      } catch (agentErr) {
        console.log("Agent not ready:", agentErr);
        // הודעת fallback
        setMessages([
          {
            role: "assistant",
            content: "שלום! 👋 אני העוזר החכם שלך למערכת CRM.\n\nאני כאן כדי לעזור לך להגדיר את המערכת בצורה המושלמת לעסק שלך.\n\n**בוא נתחיל!** ספר לי קצת על העסק שלך:\n\n🏢 **מה סוג העסק שלך?**\n\nלדוגמה:\n• עסק שירות\n• חנות\n• פרסום\n• מכללה\n• שירות דרך\n• אחר\n\nפשוט כתוב לי בכמה מילים..."
          }
        ]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Setup error:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!conversation?.id) return;
    
    const unsubscribe = base44.agents.subscribeToConversation(
      conversation.id, 
      (data) => {
        if (data?.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    );
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [conversation?.id]);

  // גלילה אוטומטית למטה כשיש הודעות חדשות
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    
    const messageToSend = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);
    
    // הוסף את ההודעה מיד ל-UI
    const userMessage = {
      role: "user",
      content: messageToSend,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    try {
      if (conversation) {
        // אם יש שיחה עם הבוט - שלח דרכו
        await base44.agents.addMessage(conversation, {
          role: "user",
          content: messageToSend
        });
      } else {
        // fallback responses
        setTimeout(() => {
          let botResponse = "";
          
          const lowerMsg = messageToSend.toLowerCase();
          
          if (lowerMsg.includes("איקומרס") || lowerMsg.includes("שירות") || lowerMsg.includes("ליווי") || lowerMsg.includes("פיננסי")) {
            botResponse = "מעולה! עסק בתחום האיקומרס - זה בדיוק מה שהמערכת נועדה לו!\n\n**שאלה נוספת:** כמה עובדים יש לך בעסק?\n\nזה יעזור לי להבין איזה סוג הרשאות תצטרך להגדיר.";
          } else if (lowerMsg.match(/\d+/) || lowerMsg.includes("עובד") || lowerMsg.includes("איש")) {
            botResponse = "נהדר! 👥\n\n**בוא נדבר על תפקידים והרשאות:**\n\nיש לנו כמה סוגי תפקידים במערכת:\n\n🔹 **מנהל** - גישה מלאה לכל המערכת\n🔹 **טכנאי** - ניהול משימות ולקוחות\n🔹 **קבלה** - רישום לקוחות ותזמון\n🔹 **צופה** - צפייה בלבד\n\n**מה הכי חשוב לך** במערכת?\n• מעקב אחר לקוחות?\n• ניהול משימות?\n• תזכורות אוטומטיות?\n• דוחות וסטטיסטיקות?";
          } else if (lowerMsg.includes("מעקב") || lowerMsg.includes("משימות") || lowerMsg.includes("תזכורות") || lowerMsg.includes("דוחות")) {
            botResponse = "מצוין! 📊 אני רואה שאתה מבין מה חשוב!\n\n**המלצות שלי:**\n\n✅ השתמש במודול **לקוחות** - לניהול מלא של כל הלקוחות שלך\n✅ מודול **משימות** - עם דירוג דחיפות ותזכורות\n✅ מודול **משימות קצרות** - למשימות של 5 דקות\n✅ **דוחות** - לראות בדיוק מה קורה בעסק\n\n**אתה מוכן להתחיל לעבוד עם המערכת?**\n\nאפשר ללחוץ על \"סיימנו\" למטה ולהתחיל! 🚀";
          } else {
            botResponse = "מעניין! 😊\n\nספר לי יותר - מה אתה צריך מהמערכת?\n\nאני כאן כדי לעזור לך להגדיר הכל בצורה הטובה ביותר עבורך!\n\n💡 **טיפ:** אתה יכול גם ללחוץ על \"דלג והתחל לעבוד\" למטה אם אתה רוצה לחקור את המערכת בעצמך.";
          }
          
          setMessages(prev => [...prev, {
            role: "assistant",
            content: botResponse,
            created_at: new Date().toISOString()
          }]);
        }, 1000);
      }
    } catch (error) {
      console.error("Send error:", error);
      toast({
        title: "שגיאה בשליחה",
        description: "נסה שוב",
        variant: "destructive"
      });
    }
    
    setIsSending(false);
  };

  const handleSkip = async () => {
    try {
      await base44.auth.updateMe({
        setup_completed: true,
        business_type: "לא צוין",
        role_type: "מנהל",
        permissions: {
          can_view_all_customers: true,
          can_edit_customers: true,
          can_delete: true,
          can_view_reports: true,
          can_manage_users: true
        }
      });
      
      toast({
        title: "התחלנו! 🎉",
        description: "ברוך הבא למערכת CRM שלך"
      });
      
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Skip error:", error);
    }
  };

  const handleComplete = async () => {
    try {
      await base44.auth.updateMe({
        setup_completed: true,
        business_type: "הוגדר דרך בוט",
        role_type: "מנהל",
        permissions: {
          can_view_all_customers: true,
          can_edit_customers: true,
          can_delete: true,
          can_view_reports: true,
          can_manage_users: true
        }
      });
      
      toast({
        title: "🎉 מעולה! ההתקנה הושלמה",
        description: "בוא נתחיל לעבוד!"
      });
      
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Complete error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">מכין את העוזר החכם שלך...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4 shadow-lg">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">העוזר החכם שלך 🤖</h1>
          <p className="text-lg text-slate-600">בוא נגדיר את המערכת יחד בשיחה קצרה</p>
        </motion.div>

        <Card className="border-none shadow-2xl bg-white mb-4" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
            <CardTitle className="flex items-center gap-3 text-xl">
              <MessageCircle className="w-6 h-6" />
              שיחה עם העוזר
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-6" style={{ maxHeight: '400px' }}>
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-5 h-5 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
              
              {isSending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
          
          <div className="border-t border-slate-100 p-4 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end"> {/* Added items-end for vertical alignment */}
              <textarea // Replaced Input with textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { // Handle Enter key for sending
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="כתוב את התשובה שלך... (Enter לשליחה, Shift+Enter לשורה חדשה)"
                className="flex-1 text-base p-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] max-h-[120px]" // Styling for expanding textarea
                disabled={isSending}
                rows={1} // Start with 1 row
                style={{
                  height: 'auto', // Allow height to be determined by content
                  overflowY: inputMessage.split('\n').length > 3 ? 'auto' : 'hidden' // Show scrollbar if more than 3 lines
                }}
                onInput={(e) => { // Auto-adjust height on input
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; // Cap max height at 120px
                }}
              />
              <Button
                type="submit"
                disabled={isSending || !inputMessage.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 px-6"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </form>
          </div>
        </Card>

        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-slate-600 hover:text-slate-900"
          >
            דלג והתחל לעבוד →
          </Button>
          
          {messages.length > 4 && (
            <Button
              onClick={handleComplete}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              <Sparkles className="w-4 h-4 ml-2" />
              סיימנו - בוא נתחיל! 🚀
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
