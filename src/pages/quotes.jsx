import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, TrendingUp, Trash2, Loader2, MessageSquare, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuoteForm from "@/components/quotes/quoteform";
import QuoteView from "@/components/quotes/quoteview";
import { format } from 'date-fns';
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Quotes() {
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("leads");
  const [user, setUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isClosureDialogOpen, setIsClosureDialogOpen] = useState(false);
  const [closureType, setClosureType] = useState(null); // "won" or "lost"
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isAddingCustomReason, setIsAddingCustomReason] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState(null);

  const confirmDelete = () => {
    if (quoteToDelete) {
      deleteMutation.mutate(quoteToDelete.id);
      setQuoteToDelete(null);
    }
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => { });
  }, []);

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.Quote.list('-created_date'),
    initialData: []
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
    initialData: []
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list(),
    initialData: []
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const results = await base44.entities.Settings.list();
      return results[0] || { rejection_reasons: ["לא מעוניין", "לא מתאים", "מצא פתרון אחר", "מחיר גבוה מדי", "לא עונה"] };
    },
  });



  // טיפול בפרמטרים מה-URL
  useEffect(() => {
    if (!quotes || !leads) return;

    const urlParams = new URLSearchParams(window.location.search);
    const quoteId = urlParams.get('quote_id');
    const leadId = urlParams.get('lead_id');

    if (quoteId && quotes.length > 0) {
      const quote = quotes.find(q => q.id === quoteId);
      if (quote) {
        handleView(quote);
      }
    } else if (leadId && leads.length > 0) {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        handleCreateQuoteForLead(lead);
      }
    }
  }, [quotes, leads]);

  const leadsWaitingForQuote = leads.filter(l => l.status === "ממתין להצעה");

  // Helper to safe-guard quote payload
  const cleanQuotePayload = (data) => {
    const safeData = {
      customer_name: data.customer_name,
      status: data.status || "טיוטה",
      grand_total: data.grand_total || 0,
    };

    if (data.lead_id) safeData.lead_id = data.lead_id;
    if (data.customer_phone) safeData.customer_phone = data.customer_phone;
    if (data.customer_email) safeData.customer_email = data.customer_email;
    if (data.valid_until) safeData.valid_until = data.valid_until;
    if (data.items) safeData.items = data.items;

    // Financials and Logic
    if (data.discount !== undefined) safeData.discount = data.discount;
    if (data.vat !== undefined) safeData.vat = data.vat;
    if (data.notes) safeData.notes = data.notes;

    // Handle sub_total confusion
    if (data.sub_total !== undefined) safeData.sub_total = data.sub_total;
    else if (data.subtotal !== undefined) safeData.sub_total = data.subtotal;

    if (data.payment_link) safeData.payment_link = data.payment_link;
    if (data.payment_status) safeData.payment_status = data.payment_status;

    return safeData;
  };

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data) => {
      const payload = cleanQuotePayload(data);

      if (editingQuote) {
        return base44.entities.Quote.update(editingQuote.id, payload);
      } else {
        // Serial Logic REMOVED for stability
        // Just create generic quote
        return base44.entities.Quote.create(payload);
      }
    },
    onSuccess: async (savedQuote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });

      // עדכון הליד ל"התקיימה פגישה" אחרי יצירת הצעת מחיר
      if (savedQuote.lead_id && !editingQuote) {
        const lead = leads.find(l => l.id === savedQuote.lead_id);

        if (lead) {
          await base44.entities.Lead.update(lead.id, {
            ...lead,
            status: "התקיימה פגישה",
            quote_id: savedQuote.id
          });
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          toast({ title: "✓ הצעת המחיר נוצרה והליד עודכן ל'התקיימה פגישה'" });

          // חזרה לעמוד הלידים
          setTimeout(() => {
            window.location.href = '/Leads';
          }, 500);
          return;
        }
      }

      if (savedQuote.lead_id && savedQuote.status === "אושרה") {
        const lead = leads.find(l => l.id === savedQuote.lead_id);

        if (lead) {
          await base44.entities.Lead.update(lead.id, {
            ...lead,
            status: "הצעה אושרה",
            quote_status: "אושרה",
            quote_id: savedQuote.id
          });
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      }

      setShowForm(false);
      setEditingQuote(null);
      setSelectedLead(null);

      // החזרת ההצעה שנשמרה
      return savedQuote;
    },
    onError: (error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (quoteId) => base44.entities.Quote.delete(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: "✓ הצעת המחיר נמחקה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה במחיקה", description: error.message, variant: "destructive" });
    }
  });

  const handleDelete = (quote) => {
    if (!user || user.role !== "admin") {
      toast({ title: "אין הרשאה", description: "רק מנהל יכול למחוק הצעות מחיר", variant: "destructive" });
      return;
    }
    setQuoteToDelete(quote);
  };

  const handleEdit = (quote) => {
    setEditingQuote(quote);
    setShowEditDialog(true);
    setViewingQuote(null);
    setSelectedLead(null);
  };

  const handleView = (quote) => {
    setViewingQuote(quote);
    setShowForm(false);
    setEditingQuote(null);
    setSelectedLead(null);
  };

  const handleNewQuote = () => {
    setEditingQuote(null);
    setSelectedLead(null);
    setShowForm(true);
    setViewingQuote(null);
  };

  const handleCreateQuoteForLead = (lead) => {
    setSelectedLead(lead);
    setEditingQuote(null);
    setShowForm(true);
    setViewingQuote(null);
  };

  const handleQuoteCreated = (updatedQuote) => {
    // פותח את QuoteView עם ההצעה המעודכנת (כולל payment_link)
    setViewingQuote(updatedQuote);
    setShowForm(false);
  };

  const handleQuoteClosed = (quote, type) => {
    setSelectedQuote(quote);
    setClosureType(type);
    setRejectionReason("");
    setCustomReason("");
    setIsAddingCustomReason(false);

    if (type === "won") {
      // סגר - עדכון מיידי
      handleCloseQuoteWon(quote);
    } else {
      // לא סגר - פתיחת דיאלוג
      setIsClosureDialogOpen(true);
    }
  };

  const handleCloseQuoteWon = async (quote) => {
    try {
      // עדכון ההצעה לאושרה
      await base44.entities.Quote.update(quote.id, { ...quote, status: "אושרה" });

      // עדכון הליד לסגר
      if (quote.lead_id) {
        const lead = leads.find(l => l.id === quote.lead_id);
        if (lead) {
          await base44.entities.Lead.update(lead.id, {
            ...lead,
            status: "סגר",
            actual_value: quote.grand_total || 0
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: "✓ ההצעה אושרה והליד עודכן ללקוח" });
    } catch (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    }
  };

  const handleCloseQuoteLost = async () => {
    if (!rejectionReason && !customReason) {
      toast({ title: "נא לבחור סיבה", variant: "destructive" });
      return;
    }

    const finalReason = rejectionReason === "אחר - הוסף חדש" ? customReason : rejectionReason;

    if (!finalReason) {
      toast({ title: "נא למלא סיבה", variant: "destructive" });
      return;
    }

    // אם זו סיבה חדשה, נוסיף אותה להגדרות
    if (rejectionReason === "אחר - הוסף חדש" && settings) {
      const currentReasons = settings.rejection_reasons || [];
      if (!currentReasons.includes(finalReason)) {
        if (settings.id) {
          await base44.entities.Settings.update(settings.id, {
            ...settings,
            rejection_reasons: [...currentReasons, finalReason]
          });
        } else {
          await base44.entities.Settings.create({
            rejection_reasons: [...currentReasons, finalReason]
          });
        }
        queryClient.invalidateQueries({ queryKey: ['settings'] });
      }
    }

    try {
      // עדכון ההצעה לבוטלה
      await base44.entities.Quote.update(selectedQuote.id, { ...selectedQuote, status: "בוטלה" });

      // עדכון הליד ללא סגר
      if (selectedQuote.lead_id) {
        const lead = leads.find(l => l.id === selectedQuote.lead_id);
        if (lead) {
          await base44.entities.Lead.update(lead.id, {
            ...lead,
            status: "לא סגר",
            rejection_reason: finalReason
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsClosureDialogOpen(false);
      toast({ title: "✓ ההצעה בוטלה והליד עודכן" });
    } catch (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    }
  };

  const filteredQuotes = quotes.filter(q =>
    q.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.serial_number?.includes(searchQuery)
  );

  const filteredLeads = leadsWaitingForQuote.filter(l =>
    l.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.customer_phone?.includes(searchQuery)
  );

  const statusColors = {
    "טיוטה": "bg-gray-100 text-gray-800",
    "נשלחה": "bg-blue-100 text-blue-800",
    "אושרה": "bg-green-100 text-green-800",
    "בוטלה": "bg-red-100 text-red-800"
  };

  if (viewingQuote) {
    return <QuoteView quote={viewingQuote} onBack={() => setViewingQuote(null)} onEdit={handleEdit} />;
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <FileText className="w-10 h-10 text-blue-600" />
              הצעות מחיר
            </h1>
            <p className="text-slate-600">
              {viewMode === "quotes"
                ? `ניהול הצעות מחיר (${quotes.length})`
                : `לידים ממתינים להצעה (${leadsWaitingForQuote.length})`
              }
            </p>
          </div>
          <Button onClick={handleNewQuote} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-5 h-5 ml-2" />
            הצעה חדשה
          </Button>
        </motion.div>

        <Card className="mb-6 border-none shadow-lg bg-white p-4">
          <div className="flex flex-col gap-4">
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                <TabsTrigger value="leads">
                  <TrendingUp className="w-4 h-4 ml-2" />
                  לידים ממתינים ({leadsWaitingForQuote.length})
                </TabsTrigger>
                <TabsTrigger value="quotes">
                  <FileText className="w-4 h-4 ml-2" />
                  הצעות מחיר ({quotes.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder={viewMode === "quotes" ? "חיפוש הצעות (שם, מספר סידורי)..." : "חיפוש לידים..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-12"
              />
            </div>
          </div>
        </Card>

        {viewMode === "leads" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredLeads.map((lead, index) => (
                <motion.div key={lead.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className="hover:shadow-xl transition-all border-none bg-white">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex justify-between items-start">
                        <div>
                          {lead.serial_number && <div className="text-xs text-slate-500 mb-1 font-mono">#{lead.serial_number}</div>}
                          <h3 className="text-lg font-bold text-slate-900 mb-1">{lead.customer_name}</h3>
                          <Badge className="bg-yellow-100 text-yellow-800">ממתין להצעה</Badge>
                        </div>
                        <Badge variant="outline">{lead.service_type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                      <div className="text-sm text-slate-600">
                        <p className="flex items-center gap-2">📞 {lead.customer_phone}</p>
                        <p className="flex items-center gap-2 mt-1">📍 {lead.customer_address}</p>
                      </div>

                      {lead.vehicle_manufacturer && (
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-sm font-semibold text-slate-700">פרטי :</p>
                          <p className="text-sm text-slate-600">
                            🚗 {lead.vehicle_manufacturer} {lead.vehicle_model} ({lead.vehicle_year})
                          </p>
                          {lead.battery_ah && (
                            <p className="text-sm text-slate-600">
                              🔋 {lead.battery_ah}Ah, {lead.battery_cca}CCA, {lead.battery_polarity}
                            </p>
                          )}
                        </div>
                      )}

                      {lead.notes && (
                        <div className="text-xs text-slate-500 bg-blue-50 p-2 rounded">
                          💬 {lead.notes}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => handleCreateQuoteForLead(lead)}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 ml-2" />
                          צור הצעה
                        </Button>
                        {lead.customer_phone && (
                          <a
                            href={`https://wa.me/972${lead.customer_phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(`היי ${lead.customer_name}\nבהמשך לשיחה שלנו, מסכם לך בקצרה איך אנחנו עובדים ב-richecom:\n\nהמטרה היא אחת\nלבנות חנות שעובדת ומגיעה למכירות בצורה עקבית.\n\nמה התהליך כולל:\n• בניית חנות Shopify פרימיום\n• מחקר מוצרים ומסרים מדויקים\n• אסטרטגיית טראפיק ראשונית\n• תשתית מדידה מלאה (פיקסל, GA4)\n• אוטומציות בסיסיות למכירה\n• ליווי אישי 1-על-1 לאורך הדרך\n\nההשקעה שלך בתהליך:\n7,500 ₪ + מע״מ\n\nאנחנו עובדים איתך, צעד-צעד,\nולא משחררים לפני שהחנות מתחילה למכור.\n\nאם זה מדויק לך\nתן אישור ונצא לדרך.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button className="w-full bg-green-600 hover:bg-green-700">
                              <MessageSquare className="w-4 h-4 ml-2" />
                              וואטסאפ
                            </Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredQuotes.map((quote, index) => (
                <motion.div key={quote.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className="hover:shadow-xl transition-all border-none bg-white">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          {quote.serial_number && <div className="text-xs text-slate-500 mb-1 font-mono">#{quote.serial_number}</div>}
                          <h3 className="text-lg font-bold text-slate-900 cursor-pointer hover:text-blue-600" onClick={() => handleView(quote)}>
                            {quote.customer_name}
                          </h3>
                        </div>
                        <Badge className={statusColors[quote.status]}>{quote.status}</Badge>
                      </div>
                      <div className="mt-4">
                        <p className="text-2xl font-bold text-slate-800">₪{quote.grand_total?.toLocaleString() || 0}</p>
                        <p className="text-xs text-slate-500">תוקף עד: {quote.valid_until ? format(new Date(quote.valid_until), "dd/MM/yy") : 'N/A'}</p>
                      </div>

                      <div className="space-y-2 mt-4 pt-4 border-t">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleQuoteClosed(quote, "won")}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={quote.status === "אושרה" || quote.status === "בוטלה"}
                          >
                            <CheckCircle className="w-4 h-4 ml-2" />
                            סגר
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleQuoteClosed(quote, "lost")}
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                            disabled={quote.status === "אושרה" || quote.status === "בוטלה"}
                          >
                            <XCircle className="w-4 h-4 ml-2" />
                            לא סגר
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleView(quote)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            צפה
                          </Button>
                          {quote.customer_phone && (
                            <a
                              href={`https://wa.me/972${quote.customer_phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(`היי ${quote.customer_name}\nבהמשך לשיחה שלנו, מסכם לך בקצרה איך אנחנו עובדים ב-richecom:\n\nהמטרה היא אחת\nלבנות חנות שעובדת ומגיעה למכירות בצורה עקבית.\n\nמה התהליך כולל:\n• בניית חנות Shopify פרימיום\n• מחקר מוצרים ומסרים מדויקים\n• אסטרטגיית טראפיק ראשונית\n• תשתית מדידה מלאה (פיקסל, GA4)\n• אוטומציות בסיסיות למכירה\n• ליווי אישי 1-על-1 לאורך הדרך\n\nההשקעה שלך בתהליך:\n₪${quote.grand_total?.toLocaleString() || '0'}\n\nאנחנו עובדים איתך, צעד-צעד,\nולא משחררים לפני שהחנות מתחילה למכור.\n\nאם זה מדויק לך\nתן אישור ונצא לדרך.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                          {user?.role === "admin" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(quote)}
                              disabled={deleteMutation.isPending}
                              className="w-full hover:bg-red-600"
                            >
                              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {((viewMode === "quotes" && filteredQuotes.length === 0) ||
          (viewMode === "leads" && filteredLeads.length === 0)) && (
            <Card className="p-12 text-center">
              {viewMode === "quotes" ? <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" /> : <TrendingUp className="w-16 h-16 mx-auto text-slate-300 mb-4" />}
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                {viewMode === "quotes" ? "אין הצעות מחיר" : "אין לידים ממתינים"}
              </h3>
              <p className="text-slate-500">
                {viewMode === "quotes" ? "התחל ביצירת הצעת המחיר הראשונה" : "כל הלידים כבר קיבלו הצעת מחיר"}
              </p>
            </Card>
          )}

        <Dialog open={showForm && !editingQuote} onOpenChange={(open) => { if (!open) { setShowForm(false); setSelectedLead(null); } }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>הצעת מחיר חדשה</DialogTitle>
            </DialogHeader>
            <QuoteForm
              quote={null}
              selectedLead={selectedLead}
              leads={leads}
              inventory={inventory}
              onSubmit={createOrUpdateMutation.mutateAsync}
              onCancel={() => {
                setShowForm(false);
                setSelectedLead(null);
              }}
              onQuoteCreated={handleQuoteCreated}
              isSubmitting={createOrUpdateMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) { setShowEditDialog(false); setEditingQuote(null); } }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>עריכת הצעת מחיר</DialogTitle>
            </DialogHeader>
            <QuoteForm
              quote={editingQuote}
              selectedLead={null}
              leads={leads}
              inventory={inventory}
              onSubmit={createOrUpdateMutation.mutateAsync}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingQuote(null);
              }}
              onQuoteCreated={handleQuoteCreated}
              isSubmitting={createOrUpdateMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isClosureDialogOpen} onOpenChange={(open) => {
          setIsClosureDialogOpen(open);
          if (!open) {
            setRejectionReason("");
            setCustomReason("");
            setIsAddingCustomReason(false);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>למה ההצעה לא נסגרה?</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>בחר סיבה *</Label>
                <Select value={rejectionReason} onValueChange={(value) => {
                  setRejectionReason(value);
                  setIsAddingCustomReason(value === "אחר - הוסף חדש");
                  if (value !== "אחר - הוסף חדש") {
                    setCustomReason("");
                  }
                }}>
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue placeholder="בחר סיבה..." />
                  </SelectTrigger>
                  <SelectContent>
                    {settings?.rejection_reasons?.map((reason, idx) => (
                      <SelectItem key={idx} value={reason}>{reason}</SelectItem>
                    ))}
                    <SelectItem value="אחר - הוסף חדש">אחר - הוסף חדש</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAddingCustomReason && (
                <div className="space-y-2">
                  <Label htmlFor="custom-reason">סיבה חדשה *</Label>
                  <Input
                    id="custom-reason"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="הקלד סיבה חדשה..."
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="bg-gray-100 hover:bg-gray-200">ביטול</Button>
              </DialogClose>
              <Button onClick={handleCloseQuoteLost} className="bg-blue-600 hover:bg-blue-700 text-white">
                שמור
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>מחיקת הצעת מחיר</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>האם למחוק את ההצעה של <strong>{quoteToDelete?.customer_name}</strong>?</p>
              <p className="text-sm text-gray-500 mt-2">פעולה זו אינה הפיכה.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuoteToDelete(null)}>ביטול</Button>
              <Button variant="destructive" onClick={confirmDelete}>
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "כן, מחק"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
