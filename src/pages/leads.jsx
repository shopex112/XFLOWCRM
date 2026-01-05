import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, TrendingUp, Edit, Trash2, DollarSign, Phone, Loader2, MessageSquare, FileText, User, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import _ from 'lodash';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const MetricCard = ({ title, value, color }) => (
  <Card className={`border-none shadow-md bg-white`}>
    <CardContent className="p-4">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-slate-500">{title}</p>
    </CardContent>
  </Card>
);

export default function Leads() {
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLostReasonDialogOpen, setIsLostReasonDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [leadToUpdate, setLeadToUpdate] = useState(null);
  const [customReason, setCustomReason] = useState("");
  const [isAddingCustomReason, setIsAddingCustomReason] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [questionnaireFilter, setQuestionnaireFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    company_name: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    age: undefined,
    lead_rating: undefined,
    status: "חדש",
    rejection_reason: "",
    traffic_source: "אינסטגרם",
    conversion_source: "DM",
    registration_source: "מתנה חינמית",
    ad_method: "אורגני",
    filled_questionnaire: false,
    questionnaire: {},
    meeting_date: undefined,
    quote_id: "",
    actual_value: 0,
    notes: "",
    serial_number: ""
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const results = await base44.entities.Settings.list();
      return results[0] || { rejection_reasons: ["לא מעוניין", "לא מתאים", "מצא פתרון אחר", "מחיר גבוה מדי", "לא עונה"] };
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.Quote.list(),
    initialData: []
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
    initialData: []
  });

  const createMutation = useMutation({
    mutationFn: async (taskData) => {
      const allLeads = await base44.entities.Lead.list();
      const maxSerial = allLeads.reduce((max, lead) => {
        if (lead.serial_number && lead.serial_number.startsWith('1')) {
          const num = parseInt(lead.serial_number.substring(1), 10);
          if (!isNaN(num)) {
            return num > max ? num : max;
          }
        }
        return max;
      }, 0);
      const newSerial = `1${String(maxSerial + 1).padStart(4, '0')}`;
      
      const cleanData = { ...taskData, serial_number: newSerial };
      
      // ניקוי טלפון - הסרת 0 מההתחלה אם קיים
      if (cleanData.customer_phone && cleanData.customer_phone.startsWith('0')) {
        cleanData.customer_phone = cleanData.customer_phone.substring(1);
      }
      
      // בדיקה אם יש ליד קיים עם אותו טלפון
      const existingLead = allLeads.find(l => l.customer_phone === cleanData.customer_phone);
      const now = new Date().toISOString();
      
      // אם יש ליד קיים - נשמור את התאריך הראשוני שלו
      if (existingLead && existingLead.initial_registration_date) {
        cleanData.initial_registration_date = existingLead.initial_registration_date;
        cleanData.registration_date = now;
      } else {
        // ליד חדש לגמרי - שני התאריכים יהיו זהים
        cleanData.initial_registration_date = now;
        cleanData.registration_date = now;
      }
      
      if (cleanData.age === undefined || cleanData.age === "") delete cleanData.age;
      if (!cleanData.customer_email) delete cleanData.customer_email;
      if (!cleanData.notes) delete cleanData.notes;
      if (!cleanData.rejection_reason) delete cleanData.rejection_reason;
      if (!cleanData.meeting_date) delete cleanData.meeting_date;
      if (!cleanData.quote_id) delete cleanData.quote_id;

      return base44.entities.Lead.create({
        ...cleanData,
        created_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowForm(false);
      setFormData({
        company_name: "",
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        age: undefined,
        lead_rating: undefined,
        status: "חדש",
        rejection_reason: "",
        traffic_source: "אינסטגרם",
        conversion_source: "DM",
        registration_source: "מתנה חינמית",
        ad_method: "אורגני",
        filled_questionnaire: false,
        questionnaire: {},
        meeting_date: undefined,
        quote_id: "",
        actual_value: 0,
        notes: "",
        serial_number: ""
        });
      toast({ title: "✓ הליד נוסף בהצלחה" });
    },
    onError: (error) => {
      toast({ 
        title: "שגיאה בשמירת ליד", 
        description: error.message || "נסה שוב",
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const cleanData = { ...data };
      if (cleanData.age === undefined || cleanData.age === "") delete cleanData.age;
      if (!cleanData.customer_email) delete cleanData.customer_email;
      if (!cleanData.notes) delete cleanData.notes;
      if (!cleanData.rejection_reason) delete cleanData.rejection_reason;
      if (!cleanData.meeting_date) delete cleanData.meeting_date;
      if (!cleanData.quote_id) delete cleanData.quote_id;

      return base44.entities.Lead.update(id, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowForm(false);
      setShowEditDialog(false);
      setEditingLead(null);
      setIsLostReasonDialogOpen(false);
      setLeadToUpdate(null);
      setLostReason("");
      toast({ title: "✓ הליד עודכן" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: "✓ הליד נמחק", variant: "destructive" });
    },
  });

  const handleDelete = (lead) => {
    if (!user || user.role !== "admin") {
      toast({ title: "אין הרשאה", description: "רק מנהל יכול למחוק לידים", variant: "destructive" });
      return;
    }
    
    setLeadToDelete(lead);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (leadToDelete) {
      deleteMutation.mutate(leadToDelete.id);
      setShowDeleteDialog(false);
      setLeadToDelete(null);
    }
  };

  useEffect(() => {
    if (originalFormData && showEditDialog) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalFormData);
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, originalFormData, showEditDialog]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
    setHasUnsavedChanges(false);
  };

  const handleCloseDialog = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirmDialog(true);
    } else {
      setShowEditDialog(false);
      setEditingLead(null);
      setOriginalFormData(null);
    }
  };

  const handleForceClose = () => {
    setShowExitConfirmDialog(false);
    setShowEditDialog(false);
    setEditingLead(null);
    setOriginalFormData(null);
    setHasUnsavedChanges(false);
  };

  const handleSaveAndClose = () => {
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
    setShowExitConfirmDialog(false);
    setHasUnsavedChanges(false);
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    const initialData = {
      company_name: lead.company_name || "",
      customer_name: lead.customer_name || "",
      customer_phone: lead.customer_phone || "",
      customer_email: lead.customer_email || "",
      age: lead.age || undefined,
      lead_rating: lead.lead_rating || undefined,
      status: lead.status || "חדש",
      rejection_reason: lead.rejection_reason || "",
      traffic_source: lead.traffic_source || "אינסטגרם",
      conversion_source: lead.conversion_source || "DM",
      registration_source: lead.registration_source || "מתנה חינמית",
      ad_method: lead.ad_method || "אורגני",
      filled_questionnaire: lead.filled_questionnaire || false,
      questionnaire: lead.questionnaire || {},
      meeting_date: lead.meeting_date || undefined,
      quote_id: lead.quote_id || "",
      actual_value: lead.actual_value || 0,
      notes: lead.notes || "",
      serial_number: lead.serial_number || "",
      registration_date: lead.registration_date || undefined,
      initial_registration_date: lead.initial_registration_date || undefined
    };
    setFormData(initialData);
    setOriginalFormData(initialData);
    setHasUnsavedChanges(false);
    setShowEditDialog(true);
  };
  
  const handleStatusChange = (lead, newStatus) => {
    if (newStatus === 'לא רלוונטי' || newStatus === 'לא סגר') {
      setLeadToUpdate({ ...lead, status: newStatus });
      setIsLostReasonDialogOpen(true);
    } else {
      updateMutation.mutate({ id: lead.id, data: { ...lead, status: newStatus }});
    }
  };

  const handleSaveLostReason = async () => {
    if (!lostReason && !customReason) {
      toast({ title: "נא לבחור סיבה", variant: "destructive" });
      return;
    }
    
    const finalReason = lostReason === "אחר - הוסף חדש" ? customReason : lostReason;
    
    if (!finalReason) {
      toast({ title: "נא למלא סיבה", variant: "destructive" });
      return;
    }
    
    // אם זו סיבה חדשה, נוסיף אותה להגדרות
    if (lostReason === "אחר - הוסף חדש" && settings) {
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
    
    if (leadToUpdate) {
      updateMutation.mutate({ id: leadToUpdate.id, data: { ...leadToUpdate, rejection_reason: finalReason } });
    }
  };

  const handleQuickReject = (lead) => {
    setLeadToUpdate({ ...lead, status: 'לא רלוונטי' });
    setLostReason("");
    setCustomReason("");
    setIsAddingCustomReason(false);
    setIsLostReasonDialogOpen(true);
  };

  // טיפול בפרמטרי URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('filter');
    const timeRangeParam = urlParams.get('timeRange');
    
    if (filter) {
      switch(filter) {
        case 'relevant':
          setStatusFilter('all');
          break;
        case 'scheduled':
          setStatusFilter('נקבעה פגישה');
          break;
        case 'completed':
          setStatusFilter('התקיימה פגישה');
          break;
        case 'lost':
          setStatusFilter('לא סגר');
          break;
        case 'won':
          setStatusFilter('סגר');
          break;
      }
    }
  }, []);

  const filteredLeadsBySearch = leads.filter(lead =>
    lead.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.customer_phone?.includes(searchQuery) ||
    lead.serial_number?.includes(searchQuery)
  );

  let filteredLeads = filteredLeadsBySearch;
  
  // סינון לפי סטטוס
  if (statusFilter !== 'all') {
    filteredLeads = filteredLeads.filter(lead => lead.status === statusFilter);
  }
  
  // סינון לפי דירוג חום
  if (ratingFilter !== 'all') {
    filteredLeads = filteredLeads.filter(lead => lead.lead_rating === ratingFilter);
  }
  
  // סינון לפי מילוי שאלון
  if (questionnaireFilter !== 'all') {
    filteredLeads = filteredLeads.filter(lead => {
      if (questionnaireFilter === 'yes') return lead.filled_questionnaire === true;
      if (questionnaireFilter === 'no') return lead.filled_questionnaire !== true;
      return true;
    });
  }

  const statusColors = {
    "חדש": "bg-gray-100 text-gray-800",
    "בתהליך": "bg-blue-100 text-blue-800",
    "לא רלוונטי": "bg-red-100 text-red-800",
    "נקבעה פגישה": "bg-yellow-100 text-yellow-800",
    "התקיימה פגישה": "bg-purple-100 text-purple-800",
    "לא סגר": "bg-orange-100 text-orange-800",
    "סגר": "bg-green-100 text-green-800"
  };
  
  const ratingColors = {
    "ליד קריר": "bg-blue-100 text-blue-800 border-2 border-blue-300",
    "ליד קר קרח": "bg-cyan-100 text-cyan-800 border-2 border-cyan-300",
    "ליד נחמד": "bg-orange-100 text-orange-800 border-2 border-orange-300",
    "ליד חם אש": "bg-red-100 text-red-800 border-2 border-red-400 shadow-lg"
  };
  
  const ratingIcons = {
    "ליד קריר": "❄️",
    "ליד קר קרח": "🧊",
    "ליד נחמד": "🌤️",
    "ליד חם אש": "🔥"
  };
  
  const statusCounts = _.countBy(leads, 'status');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-blue-600" />
              לידים
            </h1>
            <p className="text-slate-600">ניהול לקוחות פוטנציאליים ({filteredLeads.length})</p>
          </div>
          <Button 
            onClick={() => {
              setShowForm(true);
              setEditingLead(null);
              setFormData({
                company_name: "",
                customer_name: "",
                customer_phone: "",
                customer_email: "",
                age: undefined,
                lead_rating: undefined,
                status: "חדש",
                rejection_reason: "",
                traffic_source: "אינסטגרם",
                conversion_source: "DM",
                registration_source: "מתנה חינמית",
                ad_method: "אורגני",
                filled_questionnaire: false,
                questionnaire: {},
                meeting_date: undefined,
                quote_id: "",
                actual_value: 0,
                notes: "",
                serial_number: ""
              });
            }}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            ליד חדש
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div onClick={() => setStatusFilter('חדש')} className="cursor-pointer">
            <MetricCard title="חדש" value={statusCounts['חדש'] || 0} color="text-gray-600" />
          </div>
          <div onClick={() => setStatusFilter('בתהליך')} className="cursor-pointer">
            <MetricCard title="בתהליך" value={statusCounts['בתהליך'] || 0} color="text-blue-600" />
          </div>
          <div onClick={() => setStatusFilter('לא רלוונטי')} className="cursor-pointer">
            <MetricCard title="לא רלוונטי" value={statusCounts['לא רלוונטי'] || 0} color="text-red-600" />
          </div>
          <div onClick={() => setStatusFilter('נקבעה פגישה')} className="cursor-pointer">
            <MetricCard title="נקבעה פגישה" value={statusCounts['נקבעה פגישה'] || 0} color="text-yellow-600" />
          </div>
          <div onClick={() => setStatusFilter('התקיימה פגישה')} className="cursor-pointer">
            <MetricCard title="התקיימה פגישה" value={statusCounts['התקיימה פגישה'] || 0} color="text-purple-600" />
          </div>
          <div onClick={() => setStatusFilter('לא סגר')} className="cursor-pointer">
            <MetricCard title="לא סגר" value={statusCounts['לא סגר'] || 0} color="text-orange-600" />
          </div>
          <div onClick={() => setStatusFilter('סגר')} className="cursor-pointer">
            <MetricCard title="סגר" value={statusCounts['סגר'] || 0} color="text-green-600" />
          </div>
        </div>

        <Card className="mb-6 border-none shadow-lg bg-white p-4">
          <div className="flex flex-col gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold text-slate-600">סינון לפי סטטוס:</span>
                <Button 
                  variant={statusFilter === "all" ? "default" : "outline"} 
                  onClick={() => setStatusFilter("all")}
                  size="sm"
                >
                  הכל
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold text-slate-600">סינון לפי דירוג חום:</span>
                <Button 
                  variant={ratingFilter === "all" ? "default" : "outline"} 
                  onClick={() => setRatingFilter("all")}
                  size="sm"
                >
                  הכל
                </Button>
                <Button 
                  variant={ratingFilter === "ליד קר קרח" ? "default" : "outline"} 
                  onClick={() => setRatingFilter("ליד קר קרח")}
                  size="sm"
                  className={ratingFilter === "ליד קר קרח" ? "" : "border-cyan-300"}
                >
                  🧊 קר קרח
                </Button>
                <Button 
                  variant={ratingFilter === "ליד קריר" ? "default" : "outline"} 
                  onClick={() => setRatingFilter("ליד קריר")}
                  size="sm"
                  className={ratingFilter === "ליד קריר" ? "" : "border-blue-300"}
                >
                  ❄️ קריר
                </Button>
                <Button 
                  variant={ratingFilter === "ליד נחמד" ? "default" : "outline"} 
                  onClick={() => setRatingFilter("ליד נחמד")}
                  size="sm"
                  className={ratingFilter === "ליד נחמד" ? "" : "border-orange-300"}
                >
                  🌤️ נחמד
                </Button>
                <Button 
                  variant={ratingFilter === "ליד חם אש" ? "default" : "outline"} 
                  onClick={() => setRatingFilter("ליד חם אש")}
                  size="sm"
                  className={ratingFilter === "ליד חם אש" ? "" : "border-red-400"}
                >
                  🔥 חם אש
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold text-slate-600">סינון לפי שאלון:</span>
                <Button 
                  variant={questionnaireFilter === "all" ? "default" : "outline"} 
                  onClick={() => setQuestionnaireFilter("all")}
                  size="sm"
                >
                  הכל
                </Button>
                <Button 
                  variant={questionnaireFilter === "yes" ? "default" : "outline"} 
                  onClick={() => setQuestionnaireFilter("yes")}
                  size="sm"
                >
                  ✅ מילא שאלון
                </Button>
                <Button 
                  variant={questionnaireFilter === "no" ? "default" : "outline"} 
                  onClick={() => setQuestionnaireFilter("no")}
                  size="sm"
                >
                  ❌ לא מילא שאלון
                </Button>
              </div>
              </div>

            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="חיפוש לידים (שם, טלפון, מספר סידורי)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-12 text-lg h-12"
              />
            </div>
          </div>
        </Card>

        {/* Dialog for New Lead */}
        <Dialog open={showForm && !editingLead} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingLead(null); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>ליד חדש</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>שם עסק (אופציונלי)</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  placeholder="שם החברה"
                  className="text-right"
                  dir="rtl"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שם איש קשר *</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                    required
                    placeholder="שם הלקוח"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>טלפון *</Label>
                  <Input
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                    required
                    placeholder="מספר טלפון"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>דואר אלקטרוני</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                    placeholder="כתובת אימייל (אופציונלי)"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>גיל</Label>
                  <Input
                    type="number"
                    value={formData.age || ""}
                    onChange={(e) => setFormData({...formData, age: e.target.value ? parseInt(e.target.value) : undefined})}
                    placeholder="גיל"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>שווי עסקה</Label>
                  <Input
                    type="number"
                    value={formData.actual_value}
                    onChange={(e) => setFormData({...formData, actual_value: parseFloat(e.target.value) || 0})}
                    placeholder="7500 - ליווי אישי"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>דירוג חום ליד</Label>
                  <Select value={formData.lead_rating || ""} onValueChange={(value) => setFormData({...formData, lead_rating: value})}>
                    <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                      <SelectValue placeholder="בחר דירוג..." />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="ליד קר קרח" className="text-right">🧊 ליד קר קרח</SelectItem>
                      <SelectItem value="ליד קריר" className="text-right">❄️ ליד קריר</SelectItem>
                      <SelectItem value="ליד נחמד" className="text-right">🌤️ ליד נחמד</SelectItem>
                      <SelectItem value="ליד חם אש" className="text-right">🔥 ליד חם אש</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>סטטוס</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="חדש" className="text-right">חדש</SelectItem>
                      <SelectItem value="בתהליך" className="text-right">בתהליך</SelectItem>
                      <SelectItem value="לא רלוונטי" className="text-right">לא רלוונטי</SelectItem>
                      <SelectItem value="נקבעה פגישה" className="text-right">נקבעה פגישה</SelectItem>
                      <SelectItem value="התקיימה פגישה" className="text-right">התקיימה פגישה</SelectItem>
                      <SelectItem value="לא סגר" className="text-right">לא סגר</SelectItem>
                      <SelectItem value="סגר" className="text-right">סגר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>מילא שאלון?</Label>
                <Select value={formData.filled_questionnaire ? "yes" : "no"} onValueChange={(value) => setFormData({...formData, filled_questionnaire: value === "yes"})}>
                  <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                    <SelectValue placeholder="בחר..." />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="yes" className="text-right">כן</SelectItem>
                    <SelectItem value="no" className="text-right">לא</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">מקורות</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>מקור הגעה</Label>
                    <Select value={formData.traffic_source} onValueChange={(value) => setFormData({...formData, traffic_source: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="אינסטגרם" className="text-right">אינסטגרם</SelectItem>
                        <SelectItem value="יוטיוב" className="text-right">יוטיוב</SelectItem>
                        <SelectItem value="אחר" className="text-right">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>מקור המרה</Label>
                    <Select value={formData.conversion_source} onValueChange={(value) => setFormData({...formData, conversion_source: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="DM" className="text-right">DM</SelectItem>
                        <SelectItem value="ביו" className="text-right">ביו</SelectItem>
                        <SelectItem value="וואטסאפ" className="text-right">וואטסאפ</SelectItem>
                        <SelectItem value="אחר" className="text-right">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>מקור הרשמה</Label>
                    <Select value={formData.registration_source} onValueChange={(value) => setFormData({...formData, registration_source: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="מתנה חינמית" className="text-right">מתנה חינמית</SelectItem>
                        <SelectItem value="דף נחיתה ראשי" className="text-right">דף נחיתה ראשי</SelectItem>
                        <SelectItem value="שאלון" className="text-right">שאלון</SelectItem>
                        <SelectItem value="אחר" className="text-right">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>שיטת פירסום</Label>
                    <Select value={formData.ad_method} onValueChange={(value) => setFormData({...formData, ad_method: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="אורגני" className="text-right">אורגני</SelectItem>
                        <SelectItem value="ממומן" className="text-right">ממומן</SelectItem>
                        <SelectItem value="חבר מביא חבר" className="text-right">חבר מביא חבר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="h-24"
                  placeholder="הערות נוספות (אופציונלי)..."
                />
              </div>
              {(formData.status === 'לא רלוונטי' || formData.status === 'לא סגר') && (
                  <div className="space-y-2">
                      <Label>סיבת {formData.status === 'לא רלוונטי' ? 'אי רלוונטיות' : 'אי סגירה'}</Label>
                      <Textarea
                          value={formData.rejection_reason}
                          onChange={(e) => setFormData({...formData, rejection_reason: e.target.value})}
                          className="h-24"
                          placeholder="לדוגמה: לא מעוניין, לא מתאים, מצא פתרון אחר..."
                      />
                  </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="bg-gray-100 hover:bg-gray-200">
                  ביטול
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-lg font-bold py-6 px-8 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                  💾 שמור שינויים
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog for Edit Lead */}
        <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) { handleCloseDialog(); } }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת ליד</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>שם עסק (אופציונלי)</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  placeholder="שם החברה"
                  className="text-right"
                  dir="rtl"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שם מלא *</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                    required
                    placeholder="שם הלקוח"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>טלפון *</Label>
                  <Input
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                    required
                    placeholder="מספר טלפון"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>דואר אלקטרוני</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                    placeholder="כתובת אימייל (אופציונלי)"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>גיל</Label>
                  <Input
                    type="number"
                    value={formData.age || ""}
                    onChange={(e) => setFormData({...formData, age: e.target.value ? parseInt(e.target.value) : undefined})}
                    placeholder="גיל"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>שווי עסקה</Label>
                  <Input
                    type="number"
                    value={formData.actual_value}
                    onChange={(e) => setFormData({...formData, actual_value: parseFloat(e.target.value) || 0})}
                    placeholder="7500 - ליווי אישי"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>דירוג חום ליד</Label>
                  <Select value={formData.lead_rating || ""} onValueChange={(value) => setFormData({...formData, lead_rating: value})}>
                    <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                      <SelectValue placeholder="בחר דירוג..." />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="ליד קר קרח" className="text-right">🧊 ליד קר קרח</SelectItem>
                      <SelectItem value="ליד קריר" className="text-right">❄️ ליד קריר</SelectItem>
                      <SelectItem value="ליד נחמד" className="text-right">🌤️ ליד נחמד</SelectItem>
                      <SelectItem value="ליד חם אש" className="text-right">🔥 ליד חם אש</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>סטטוס</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="חדש" className="text-right">חדש</SelectItem>
                      <SelectItem value="בתהליך" className="text-right">בתהליך</SelectItem>
                      <SelectItem value="לא רלוונטי" className="text-right">לא רלוונטי</SelectItem>
                      <SelectItem value="נקבעה פגישה" className="text-right">נקבעה פגישה</SelectItem>
                      <SelectItem value="התקיימה פגישה" className="text-right">התקיימה פגישה</SelectItem>
                      <SelectItem value="לא סגר" className="text-right">לא סגר</SelectItem>
                      <SelectItem value="סגר" className="text-right">סגר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תאריך הרשמה נוכחי</Label>
                  <Input
                    type="datetime-local"
                    value={formData.registration_date && !isNaN(new Date(formData.registration_date)) ? new Date(formData.registration_date).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setFormData({...formData, registration_date: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>תאריך הרשמה ראשוני</Label>
                  <Input
                    type="datetime-local"
                    value={formData.initial_registration_date && !isNaN(new Date(formData.initial_registration_date)) ? new Date(formData.initial_registration_date).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setFormData({...formData, initial_registration_date: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>דירוג חום ליד</Label>
                  <Select value={formData.lead_rating || ""} onValueChange={(value) => setFormData({...formData, lead_rating: value})}>
                    <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                      <SelectValue placeholder="בחר דירוג..." />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="ליד קר קרח" className="text-right">🧊 ליד קר קרח</SelectItem>
                      <SelectItem value="ליד קריר" className="text-right">❄️ ליד קריר</SelectItem>
                      <SelectItem value="ליד נחמד" className="text-right">🌤️ ליד נחמד</SelectItem>
                      <SelectItem value="ליד חם אש" className="text-right">🔥 ליד חם אש</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>מילא שאלון?</Label>
                  <Select value={formData.filled_questionnaire ? "yes" : "no"} onValueChange={(value) => setFormData({...formData, filled_questionnaire: value === "yes"})}>
                    <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">כן</SelectItem>
                      <SelectItem value="no">לא</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">מקורות</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>מקור הגעה</Label>
                    <Select value={formData.traffic_source} onValueChange={(value) => setFormData({...formData, traffic_source: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="אינסטגרם" className="text-right">אינסטגרם</SelectItem>
                        <SelectItem value="יוטיוב" className="text-right">יוטיוב</SelectItem>
                        <SelectItem value="אחר" className="text-right">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>מקור המרה</Label>
                    <Select value={formData.conversion_source} onValueChange={(value) => setFormData({...formData, conversion_source: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="DM" className="text-right">DM</SelectItem>
                        <SelectItem value="ביו" className="text-right">ביו</SelectItem>
                        <SelectItem value="וואטסאפ" className="text-right">וואטסאפ</SelectItem>
                        <SelectItem value="אחר" className="text-right">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>מקור הרשמה</Label>
                    <Select value={formData.registration_source} onValueChange={(value) => setFormData({...formData, registration_source: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="מתנה חינמית" className="text-right">מתנה חינמית</SelectItem>
                        <SelectItem value="דף נחיתה ראשי" className="text-right">דף נחיתה ראשי</SelectItem>
                        <SelectItem value="שאלון" className="text-right">שאלון</SelectItem>
                        <SelectItem value="אחר" className="text-right">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>שיטת פירסום</Label>
                    <Select value={formData.ad_method} onValueChange={(value) => setFormData({...formData, ad_method: value})}>
                      <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="אורגני" className="text-right">אורגני</SelectItem>
                        <SelectItem value="ממומן" className="text-right">ממומן</SelectItem>
                        <SelectItem value="חבר מביא חבר" className="text-right">חבר מביא חבר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {formData.filled_questionnaire && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">📋 שאלון</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>האם ניסית בעבר להקים חנות אונליין?</Label>
                      <Select 
                        value={formData.questionnaire?.tried_before || ""} 
                        onValueChange={(value) => setFormData({...formData, questionnaire: {...formData.questionnaire, tried_before: value}})}
                      >
                        <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                          <SelectValue placeholder="בחר..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="כן, ועדיין לא הצלחתי" className="text-right">כן, ועדיין לא הצלחתי</SelectItem>
                          <SelectItem value="נסיתי קצת" className="text-right">נסיתי קצת</SelectItem>
                          <SelectItem value="לא, זו הפעם הראשונה שלי" className="text-right">לא, זו הפעם הראשונה שלי</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

...

                    <div className="space-y-2">
                      <Label>מה האתגר הכי גדול שלך?</Label>
                      <Select 
                        value={formData.questionnaire?.biggest_challenge || ""} 
                        onValueChange={(value) => setFormData({...formData, questionnaire: {...formData.questionnaire, biggest_challenge: value}})}
                      >
                        <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                          <SelectValue placeholder="בחר..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="מציאת מוצרים שמוכרים" className="text-right">מציאת מוצרים שמוכרים</SelectItem>
                          <SelectItem value="בניית חנות מקצועית" className="text-right">בניית חנות מקצועית</SelectItem>
                          <SelectItem value="שיווק וקידום" className="text-right">שיווק וקידום</SelectItem>
                          <SelectItem value="מיתוג ובידול" className="text-right">מיתוג ובידול</SelectItem>
                          <SelectItem value="ניהול כסף ורווחיות" className="text-right">ניהול כסף ורווחיות</SelectItem>
                          <SelectItem value="אחר" className="text-right">אחר</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>מה יעד המכירות החודשי שלך?</Label>
                      <Select 
                        value={formData.questionnaire?.target_sales || ""} 
                        onValueChange={(value) => setFormData({...formData, questionnaire: {...formData.questionnaire, target_sales: value}})}
                      >
                        <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                          <SelectValue placeholder="בחר..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="עד 5,000 ₪" className="text-right">עד 5,000 ₪</SelectItem>
                          <SelectItem value="5,000-15,000 ₪" className="text-right">5,000-15,000 ₪</SelectItem>
                          <SelectItem value="15,000-30,000 ₪" className="text-right">15,000-30,000 ₪</SelectItem>
                          <SelectItem value="מעל 30,000 ₪" className="text-right">מעל 30,000 ₪</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>מה היית רוצה להשיג בליווי?</Label>
                      <Select 
                        value={formData.questionnaire?.mentoring_goal || ""} 
                        onValueChange={(value) => setFormData({...formData, questionnaire: {...formData.questionnaire, mentoring_goal: value}})}
                      >
                        <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                          <SelectValue placeholder="בחר..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="להקים חנות שעובדת" className="text-right">להקים חנות שעובדת</SelectItem>
                          <SelectItem value="להתחיל למכור מהר" className="text-right">להתחיל למכור מהר</SelectItem>
                          <SelectItem value="לבנות מותג אמיתי לטווח ארוך" className="text-right">לבנות מותג אמיתי לטווח ארוך</SelectItem>
                          <SelectItem value="להגיע להכנסה קבועה מהאיקומרס" className="text-right">להגיע להכנסה קבועה מהאיקומרס</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>מה ייחשב עבורך הצלחה?</Label>
                      <Textarea
                        value={formData.questionnaire?.success_definition || ""}
                        onChange={(e) => setFormData({...formData, questionnaire: {...formData.questionnaire, success_definition: e.target.value}})}
                        placeholder="למשל: הכנסה קבועה של 10,000 ש״ח בחודש"
                        className="h-20 text-right"
                        dir="rtl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>מה חשוב לך במי שמלווה אותך?</Label>
                      <Textarea
                        value={formData.questionnaire?.mentor_importance || ""}
                        onChange={(e) => setFormData({...formData, questionnaire: {...formData.questionnaire, mentor_importance: e.target.value}})}
                        placeholder="למשל: ניסיון מוכח, זמינות, סבלנות..."
                        className="h-20 text-right"
                        dir="rtl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>כמה זמן בשבוע אתה מוכן להשקיע?</Label>
                      <Select 
                        value={formData.questionnaire?.weekly_hours || ""} 
                        onValueChange={(value) => setFormData({...formData, questionnaire: {...formData.questionnaire, weekly_hours: value}})}
                      >
                        <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                          <SelectValue placeholder="בחר..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="פחות מ-5 שעות" className="text-right">פחות מ-5 שעות</SelectItem>
                          <SelectItem value="5-10 שעות" className="text-right">5-10 שעות</SelectItem>
                          <SelectItem value="מעל 10 שעות" className="text-right">מעל 10 שעות</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>מתי הזמן הכי טוב לשיחה?</Label>
                      <Select 
                        value={formData.questionnaire?.best_time_to_call || ""} 
                        onValueChange={(value) => setFormData({...formData, questionnaire: {...formData.questionnaire, best_time_to_call: value}})}
                      >
                        <SelectTrigger className="w-full" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                          <SelectValue placeholder="בחר..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="9:00 - 12:00" className="text-right">9:00 - 12:00</SelectItem>
                          <SelectItem value="12:00 - 15:00" className="text-right">12:00 - 15:00</SelectItem>
                          <SelectItem value="15:00 - 18:00" className="text-right">15:00 - 18:00</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="h-24 text-right"
                  dir="rtl"
                  placeholder="הערות נוספות (אופציונלי)..."
                />
              </div>
              {(formData.status === 'לא רלוונטי' || formData.status === 'לא סגר') && (
                  <div className="space-y-2">
                      <Label>סיבת {formData.status === 'לא רלוונטי' ? 'אי רלוונטיות' : 'אי סגירה'}</Label>
                      <Textarea
                          value={formData.rejection_reason}
                          onChange={(e) => setFormData({...formData, rejection_reason: e.target.value})}
                          className="h-24 text-right"
                          dir="rtl"
                          placeholder="לדוגמה: לא מעוניין, לא מתאים, מצא פתרון אחר..."
                      />
                  </div>
              )}

              {editingLead && (() => {
                const leadTasks = tasks.filter(t => t.lead_id === editingLead.id);
                return leadTasks.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-purple-600" />
                      משימות ({leadTasks.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {leadTasks.map(task => (
                        <Card key={task.id} className="bg-purple-50 border-purple-200">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{task.title}</div>
                                {task.description && (
                                  <div className="text-xs text-slate-600 mt-1">{task.description}</div>
                                )}
                                {task.due_date && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    📅 {format(new Date(task.due_date), "dd/MM/yyyy HH:mm")}
                                  </div>
                                )}
                                <Badge className="mt-2 text-xs">{task.status}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="bg-gray-100 hover:bg-gray-200">
                  ביטול
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-lg font-bold py-6 px-8 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                  💾 שמור שינויים
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showExitConfirmDialog} onOpenChange={setShowExitConfirmDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>יש לך שינויים שלא נשמרו</DialogTitle>
            </DialogHeader>
            <p className="text-slate-600 py-4">האם אתה בטוח שברצונך לצאת ללא שמירת השינויים?</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowExitConfirmDialog(false)} className="bg-gray-100 hover:bg-gray-200">
                חזור לעריכה
              </Button>
              <Button onClick={handleSaveAndClose} className="bg-green-600 hover:bg-green-700 text-white" disabled={updateMutation.isPending || createMutation.isPending}>
                {(updateMutation.isPending || createMutation.isPending) ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : "💾"} שמור וצא
              </Button>
              <Button variant="destructive" onClick={handleForceClose} className="bg-red-600 hover:bg-red-700">
                צא ללא שמירה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>אישור מחיקת ליד</DialogTitle>
            </DialogHeader>
            <p className="text-slate-600 py-4">
              האם אתה בטוח שברצונך למחוק את הליד של <strong>{leadToDelete?.customer_name}</strong>?
              <br />
              <span className="text-red-600 text-sm">פעולה זו לא ניתנת לביטול.</span>
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="bg-gray-100 hover:bg-gray-200">
                ביטול
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : "🗑️"} מחק ליד
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeads.map((lead, index) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-xl transition-all border-none bg-white">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      {lead.serial_number && <div className="text-xs text-slate-500 mb-1 font-mono">#{lead.serial_number}</div>}
                      {lead.company_name && (
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{lead.company_name}</h3>
                      )}
                      <h3 className={`${lead.company_name ? 'text-lg text-slate-700' : 'text-xl font-bold text-slate-900'}`}>
                        {lead.customer_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
                      </div>
                    </div>
                    {user?.role === "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(lead)}
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    {lead.lead_rating && (
                      <div className="mb-3">
                        <Badge className={`${ratingColors[lead.lead_rating]} text-base px-3 py-1.5 font-bold`}>
                          {ratingIcons[lead.lead_rating]} {lead.lead_rating}
                        </Badge>
                      </div>
                    )}
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-500"/> 0{lead.customer_phone}
                    </p>
                    {lead.age && (
                        <p className="text-sm text-slate-600">
                            👤 גיל: {lead.age}
                        </p>
                    )}
                    {lead.actual_value > 0 && (
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-500"/> 
                            שווי עסקה: ₪{lead.actual_value.toLocaleString()}
                        </p>
                    )}
                    {lead.filled_questionnaire && (
                        <p className="text-sm text-green-600 font-semibold">
                            ✅ מילא שאלון
                        </p>
                    )}
                    {lead.traffic_source && (
                       <p className="text-xs text-slate-500">
                           📍 {lead.traffic_source} → {lead.conversion_source} → {lead.registration_source}
                       </p>
                    )}
                    <div className="space-y-1 text-xs text-slate-500 mt-2 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">📅 הרשמה:</span>
                        {lead.registration_date && !isNaN(new Date(lead.registration_date))
                          ? format(new Date(lead.registration_date), "dd/MM/yyyy HH:mm")
                          : lead.created_date && !isNaN(new Date(lead.created_date))
                          ? format(new Date(lead.created_date), "dd/MM/yyyy HH:mm")
                          : "לא זמין"
                        }
                      </div>
                      {lead.initial_registration_date && !isNaN(new Date(lead.initial_registration_date)) && lead.registration_date && lead.initial_registration_date !== lead.registration_date && (
                        <div className="flex items-center gap-1 text-purple-600">
                          <span className="font-medium">🔄 ראשוני:</span>
                          {format(new Date(lead.initial_registration_date), "dd/MM/yyyy HH:mm")}
                          <Badge className="bg-purple-100 text-purple-700 text-xs ml-1">חוזר</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {lead.notes && (
                    <div className="bg-yellow-50 border-r-4 border-yellow-400 p-3 rounded-lg mb-4">
                      <h4 className="font-semibold text-sm text-yellow-900 mb-2 flex items-center gap-1">
                        📝 הערות
                      </h4>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}

                  {lead.questionnaire && Object.keys(lead.questionnaire).length > 0 && (
                    <div className="bg-blue-50 p-3 rounded-lg mb-4">
                      <h4 className="font-semibold text-sm text-blue-900 mb-2">📋 שאלון</h4>
                      <div className="space-y-1 text-xs">
                        {lead.questionnaire.tried_before && (
                          <p className="text-slate-700"><strong>ניסיתי בעבר:</strong> {lead.questionnaire.tried_before}</p>
                        )}
                        {lead.questionnaire.how_long_idea && (
                          <p className="text-slate-700"><strong>זמן הרעיון:</strong> {lead.questionnaire.how_long_idea}</p>
                        )}
                        {lead.questionnaire.biggest_challenge && (
                          <p className="text-slate-700"><strong>אתגר מרכזי:</strong> {lead.questionnaire.biggest_challenge}</p>
                        )}
                        {lead.questionnaire.target_sales && (
                          <p className="text-slate-700"><strong>יעד מכירות:</strong> {lead.questionnaire.target_sales}</p>
                        )}
                        {lead.questionnaire.mentoring_goal && (
                          <p className="text-slate-700"><strong>מטרת הליווי:</strong> {lead.questionnaire.mentoring_goal}</p>
                        )}
                        {lead.questionnaire.success_definition && (
                          <p className="text-slate-700"><strong>הגדרת הצלחה:</strong> {lead.questionnaire.success_definition}</p>
                        )}
                        {lead.questionnaire.mentor_importance && (
                          <p className="text-slate-700"><strong>חשוב במנטור:</strong> {lead.questionnaire.mentor_importance}</p>
                        )}
                        {lead.questionnaire.weekly_hours && (
                          <p className="text-slate-700"><strong>שעות בשבוע:</strong> {lead.questionnaire.weekly_hours}</p>
                        )}
                        {lead.questionnaire.best_time_to_call && (
                          <p className="text-slate-700"><strong>זמן לשיחה:</strong> {lead.questionnaire.best_time_to_call}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {lead.rejection_reason && (
                    <div className="text-xs text-red-700 bg-red-50 p-2 rounded mb-4">
                      <strong>סיבה:</strong> {lead.rejection_reason}
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t">
                    <Button 
                      size="sm" 
                      onClick={() => handleEdit(lead)} 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      ערוך
                    </Button>

                    {lead.status === "התקיימה פגישה" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateMutation.mutate({ 
                              id: lead.id, 
                              data: { ...lead, status: "סגר" }
                            });
                          }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          ✓ סגר
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setLeadToUpdate({ ...lead, status: 'לא סגר' });
                            setLostReason("");
                            setCustomReason("");
                            setIsAddingCustomReason(false);
                            setIsLostReasonDialogOpen(true);
                          }}
                          className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                          ✗ לא סגר
                        </Button>
                      </div>
                    )}

                    {lead.status === "סגר" && (
                      <Button
                        size="sm"
                        onClick={() => navigate(createPageUrl('Customers'))}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <User className="w-4 h-4 ml-2" />
                        עבור ללקוח
                      </Button>
                    )}

                    {(() => {
                      const existingQuote = quotes.find(q => q.lead_id === lead.id) || (lead.quote_id ? quotes.find(q => q.id === lead.quote_id) : null);
                      
                      if (existingQuote) {
                        return (
                          <Button
                            size="sm"
                            onClick={() => navigate(`${createPageUrl('Quotes')}?quote_id=${existingQuote.id}`)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <FileText className="w-4 h-4 ml-2" />
                            צפה בהצעת מחיר
                          </Button>
                        );
                      } else {
                        return (
                          <Button
                            size="sm"
                            onClick={() => navigate(`${createPageUrl('Quotes')}?lead_id=${lead.id}`)}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <FileText className="w-4 h-4 ml-2" />
                            צור הצעת מחיר
                          </Button>
                        );
                      }
                    })()}
                    
                    {lead.customer_phone && (
                      <a 
                        href={`https://wa.me/${lead.customer_phone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                          <MessageSquare className="w-4 h-4 ml-2" />
                          שלח בוואטסאפ
                        </Button>
                      </a>
                    )}
                    
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickReject(lead)}
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        ❌ לא רלוונטי
                      </Button>
                      
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-600">עדכן סטטוס ליד:</Label>
                        <Select onValueChange={(newStatus) => handleStatusChange(lead, newStatus)} value={lead.status}>
                          <SelectTrigger className="w-full bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors" dir="rtl" style={{ textAlign: 'right', direction: 'rtl' }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="חדש" className="text-right">חדש</SelectItem>
                            <SelectItem value="בתהליך" className="text-right">בתהליך</SelectItem>
                            <SelectItem value="לא רלוונטי" className="text-right">לא רלוונטי</SelectItem>
                            <SelectItem value="נקבעה פגישה" className="text-right">נקבעה פגישה</SelectItem>
                            <SelectItem value="התקיימה פגישה" className="text-right">התקיימה פגישה</SelectItem>
                            <SelectItem value="לא סגר" className="text-right">לא סגר</SelectItem>
                            <SelectItem value="סגר" className="text-right">סגר</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredLeads.length === 0 && !isLoading && (
          <Card className="p-12 text-center">
            <TrendingUp className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">אין לידים עדיין</h3>
            <p className="text-slate-500">התחל בהוספת הליד הראשון</p>
          </Card>
        )}

        <Dialog open={isLostReasonDialogOpen} onOpenChange={(open) => {
          setIsLostReasonDialogOpen(open);
          if (!open) {
            setLostReason("");
            setCustomReason("");
            setIsAddingCustomReason(false);
          }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>סיבת {leadToUpdate?.status === 'לא רלוונטי' ? 'אי רלוונטיות' : 'אי סגירה'}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label>בחר סיבה *</Label>
                      <Select value={lostReason} onValueChange={(value) => {
                        setLostReason(value);
                        setIsAddingCustomReason(value === "אחר - הוסף חדש");
                        if (value !== "אחר - הוסף חדש") {
                          setCustomReason("");
                        }
                      }}>
                        <SelectTrigger className="text-right [&>span]:text-right [&>span]:w-full [&>span]:flex [&>span]:justify-end" dir="rtl">
                          <SelectValue placeholder="בחר סיבה..." />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {settings?.rejection_reasons?.map((reason, idx) => (
                            <SelectItem key={idx} value={reason} className="text-right">{reason}</SelectItem>
                          ))}
                          <SelectItem value="אחר - הוסף חדש" className="text-right">אחר - הוסף חדש</SelectItem>
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
                    <Button onClick={handleSaveLostReason} disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}