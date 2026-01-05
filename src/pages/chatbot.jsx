import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, User as UserIcon, Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ChatBot() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    initChat();
  }, []);

  // פוקוס אוטומטי על הטקסט אריאה
  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [loading, messages]);

  const initChat = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // בדוק אם יש שיחה קיימת
      const existingConversations = await base44.agents.listConversations({
        agent_name: "crm_setup_assistant"
      });
      
      let activeConversation = null;
      
      // מצא שיחה פעילה של המשתמש
      if (existingConversations && existingConversations.length > 0) {
        activeConversation = existingConversations.find(
          conv => conv.metadata?.user_email === currentUser.email
        ) || existingConversations[0];
      }
      
      // אם אין שיחה - צור חדשה
      if (!activeConversation) {
        activeConversation = await base44.agents.createConversation({
          agent_name: "crm_setup_assistant",
          metadata: {
            name: "שיחה עם העוזר החכם",
            user_email: currentUser.email,
            user_name: currentUser.full_name
          }
        });
        
        // הודעת פתיחה רק לשיחה חדשה
        setTimeout(async () => {
          await base44.agents.addMessage(activeConversation, {
            role: "user",
            content: "היי! אני צריך עזרה במערכת"
          });
        }, 500);
      } else {
        // טען את ההודעות הקיימות
        const conversationData = await base44.agents.getConversation(activeConversation.id);
        if (conversationData?.messages) {
          setMessages(conversationData.messages);
        }
      }
      
      setConversation(activeConversation);
      setLoading(false);
      
    } catch (error) {
      console.error("Chat init error:", error);
      setMessages([
        {
          role: "assistant",
          content: "שלום! 👋 אני העוזר החכם שלך.\n\nאני כאן לעזור לך עם כל מה שצריך במערכת.\n\nמה תרצה לעשות?"
        }
      ]);
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
    
    const userMessage = {
      role: "user",
      content: messageToSend,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    try {
      if (conversation) {
        await base44.agents.addMessage(conversation, {
          role: "user",
          content: messageToSend
        });
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

  const handleNewConversation = async () => {
    try {
      const newConv = await base44.agents.createConversation({
        agent_name: "crm_setup_assistant",
        metadata: {
          name: "שיחה חדשה",
          user_email: user?.email,
          user_name: user?.full_name
        }
      });
      
      setConversation(newConv);
      setMessages([]);
      
      setTimeout(async () => {
        await base44.agents.addMessage(newConv, {
          role: "user",
          content: "היי! אני רוצה לשוחח איתך"
        });
      }, 500);
      
      toast({
        title: "✓ שיחה חדשה נוצרה",
      });
    } catch (error) {
      console.error("New conversation error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">מכין את העוזר החכם...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="hover:bg-white hover:shadow-md transition-all"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה למערכת
            </Button>
            
            <Button
              variant="outline"
              onClick={handleNewConversation}
              className="hover:bg-white hover:shadow-md transition-all"
            >
              <RotateCcw className="w-4 h-4 ml-2" />
              שיחה חדשה
            </Button>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4 shadow-lg">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">העוזר החכם שלך 🤖</h1>
            <p className="text-lg text-slate-600">שאל אותי כל שאלה או בקש שינויים במערכת</p>
          </div>
        </motion.div>

        <Card className="border-none shadow-2xl bg-white mb-4" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
            <CardTitle className="flex items-center gap-3 text-xl">
              <Sparkles className="w-6 h-6" />
              שיחה עם העוזר
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-6" style={{ maxHeight: '450px' }}>
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
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="כתוב את השאלה שלך... (Enter לשליחה, Shift+Enter לשורה חדשה)"
                className="flex-1 text-base p-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] max-h-[120px]"
                disabled={isSending}
                rows={1}
                style={{
                  height: 'auto',
                  overflowY: inputMessage.split('\n').length > 3 ? 'auto' : 'hidden'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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

        <div className="text-center text-sm text-slate-500">
          💡 אני יכול לעזור לך עם: הוספת לקוחות, שינוי הגדרות, הסבר על תכונות, ועוד
        </div>
      </div>
    </div>
  );
}