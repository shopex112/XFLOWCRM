
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, TrendingUp, Edit, Trash2, DollarSign, Phone, Loader2, MessageSquare, FileText, User, ClipboardList, Calendar } from "lucide-react";
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

// Helper function to strip unknown fields before sending to Supabase
// This prevents crashes when the DB schema is missing columns
const cleanLeadPayload = (data) => {
  const safeData = {
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    status: data.status,
    company_name: data.company_name,
    customer_email: data.customer_email,
    age: data.age,
    lead_rating: data.lead_rating,
    rejection_reason: data.rejection_reason,
    traffic_source: data.traffic_source,
    conversion_source: data.conversion_source,
    registration_source: data.registration_source,
    ad_method: data.ad_method,
    filled_questionnaire: data.filled_questionnaire,
    questionnaire: data.questionnaire,
    meeting_date: data.meeting_date,
    quote_id: data.quote_id,
    actual_value: data.actual_value,
    notes: data.notes,
    serial_number: data.serial_number,
    registration_date: data.registration_date,
    initial_registration_date: data.initial_registration_date
  };

  // Remove undefined fields to prevent Supabase errors if some are optional
  Object.keys(safeData).forEach(key => {
    if (safeData[key] === undefined) {
      delete safeData[key];
    }
  });

  return safeData;
};

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
    base44.auth.me().then(setUser).catch(() => { });
  }, []);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        const results = await base44.entities.Settings.list();
        return results[0] || { rejection_reasons: ["לא מעוניין", "לא מתאים", "מצא פתרון אחר", "מחיר גבוה מדי", "לא עונה"] };
      } catch (e) {
        return { rejection_reasons: ["לא מעוניין", "לא מתאים"] };
      }
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

      // Serial number logic REMOVED because DB column is missing.
      // const newSerial = ...

      const cleanData = { ...taskData }; // No serial number added

      if (cleanData.customer_phone && cleanData.customer_phone.startsWith('0')) {
        cleanData.customer_phone = cleanData.customer_phone.substring(1);
      }

      const existingLead = allLeads.find(l => l.customer_phone === cleanData.customer_phone);
      const now = new Date().toISOString();

      if (existingLead && existingLead.initial_registration_date) {
        cleanData.initial_registration_date = existingLead.initial_registration_date;
        cleanData.registration_date = now;
      } else {
        cleanData.initial_registration_date = now;
        cleanData.registration_date = now;
      }

      const payload = cleanLeadPayload(cleanData);


      return base44.entities.Lead.create(payload);
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
      const payload = cleanLeadPayload(data);
      return base44.entities.Lead.update(id, payload);
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
    onError: (error) => {
      toast({ title: "שגיאה במחיקה", description: error.message, variant: "destructive" });
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
      updateMutation.mutate({ id: lead.id, data: { ...lead, status: newStatus } });
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
          try {
            await base44.entities.Settings.update(settings.id, {
              ...settings,
              rejection_reasons: [...currentReasons, finalReason]
            });
          } catch (e) { console.error(e) }
        } else {
          try {
            await base44.entities.Settings.create({
              rejection_reasons: [...currentReasons, finalReason]
            });
          } catch (e) { console.error(e) }
        }
        queryClient.invalidateQueries({ queryKey: ['settings'] });
      }
    }

    if (leadToUpdate) {
      updateMutation.mutate({ id: leadToUpdate.id, data: { ...leadToUpdate, rejection_reason: finalReason } });
    }
  };

  // טיפול בפרמטרי URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('filter');

    if (filter) {
      switch (filter) {
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredLeads.map((lead, index) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Card className="hover:shadow-xl transition-all border-none bg-white relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusColors[lead.status]?.split(' ')[0] || 'bg-slate-200'}`} />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      {lead.serial_number && (
                        <span className="text-[10px] font-mono text-slate-400 block mb-1">
                          #{lead.serial_number}
                        </span>
                      )}
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {lead.customer_name}
                        {lead.lead_rating && (
                          <span className="text-lg" title={lead.lead_rating}>
                            {ratingIcons[lead.lead_rating]}
                          </span>
                        )}
                      </h3>
                      {lead.company_name && (
                        <p className="text-sm text-slate-500 font-medium">{lead.company_name}</p>
                      )}
                    </div>
                    <Badge className={`${statusColors[lead.status]} border-none px-3 py-1 text-xs font-bold whitespace-nowrap`}>
                      {lead.status}
                    </Badge>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span dir="ltr">{lead.customer_phone}</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-800">
                        ₪{(lead.actual_value || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span>
                        {lead.created_at ? format(new Date(lead.created_at), 'dd/MM/yyyy') : '---'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(lead)}
                      className="border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      עריכה
                    </Button>
                    <a
                      href={`https://wa.me/972${lead.customer_phone?.replace(/^0/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex"
                    >
                      <Button
                        variant="soft"
                        size="sm"
                        className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-semibold border-none"
                      >
                        <MessageSquare className="w-4 h-4 ml-2" />
                        וואטסאפ
                      </Button>
                    </a>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const quoteUrl = createPageUrl('Quotes', { leadId: lead.id, customerName: lead.customer_name });
                        navigate(quoteUrl);
                      }}
                      className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                    >
                      <FileText className="w-4 h-4 ml-2" />
                      הצעת מחיר
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(lead)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredLeads.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100 mb-8"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">לא נמצאו לידים תואמים</h3>
            <p className="text-slate-500 mt-1">נסו לשנות את מסנני החיפוש</p>
          </motion.div>
        )}

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
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : undefined })}
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
                    onChange={(e) => setFormData({ ...formData, actual_value: parseFloat(e.target.value) || 0 })}
                    placeholder="7500 - ליווי אישי"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>דירוג חום ליד</Label>
                  <Select value={formData.lead_rating || ""} onValueChange={(value) => setFormData({ ...formData, lead_rating: value })}>
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
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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
                <Select value={formData.filled_questionnaire ? "yes" : "no"} onValueChange={(value) => setFormData({ ...formData, filled_questionnaire: value === "yes" })}>
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
                    <Select value={formData.traffic_source} onValueChange={(value) => setFormData({ ...formData, traffic_source: value })}>
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
                    <Select value={formData.conversion_source} onValueChange={(value) => setFormData({ ...formData, conversion_source: value })}>
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
                    <Select value={formData.registration_source} onValueChange={(value) => setFormData({ ...formData, registration_source: value })}>
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
                    <Select value={formData.ad_method} onValueChange={(value) => setFormData({ ...formData, ad_method: value })}>
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
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-24 text-right"
                  dir="rtl"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  שמור ליד
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog for Editing Lead */}
        <Dialog open={showEditDialog} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת ליד - {editingLead?.customer_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Same fields as create form but pre-filled */}
              <div className="space-y-2">
                <Label>שם עסק (אופציונלי)</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : undefined })}
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
                    onChange={(e) => setFormData({ ...formData, actual_value: parseFloat(e.target.value) || 0 })}
                    placeholder="7500 - ליווי אישי"
                    className="text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>דירוג חום ליד</Label>
                  <Select value={formData.lead_rating || ""} onValueChange={(value) => setFormData({ ...formData, lead_rating: value })}>
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
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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
                <Select value={formData.filled_questionnaire ? "yes" : "no"} onValueChange={(value) => setFormData({ ...formData, filled_questionnaire: value === "yes" })}>
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
                    <Select value={formData.traffic_source} onValueChange={(value) => setFormData({ ...formData, traffic_source: value })}>
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
                    <Select value={formData.conversion_source} onValueChange={(value) => setFormData({ ...formData, conversion_source: value })}>
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
                    <Select value={formData.registration_source} onValueChange={(value) => setFormData({ ...formData, registration_source: value })}>
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
                    <Select value={formData.ad_method} onValueChange={(value) => setFormData({ ...formData, ad_method: value })}>
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
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-24 text-right"
                  dir="rtl"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={handleCloseDialog}>ביטול</Button>
                <Button type="submit" disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  עדכן ליד
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog for Exit Confirmation */}
        <Dialog open={showExitConfirmDialog} onOpenChange={setShowExitConfirmDialog}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>לשמור שינויים?</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>ביצעת שינויים בטופס. האם ברצונך לשמור אותם לפני היציאה?</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleForceClose}>צא ללא שמירה</Button>
              <Button onClick={handleSaveAndClose} className="bg-blue-600 hover:bg-blue-700">שמור וצא</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog for Lost Reason */}
        <Dialog open={isLostReasonDialogOpen} onOpenChange={setIsLostReasonDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>סיבת דחייה/פספוס</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Label>מדוע הליד לא רלוונטי?</Label>
              <Select value={lostReason} onValueChange={(val) => {
                setLostReason(val);
                if (val === "אחר - הוסף חדש") {
                  setIsAddingCustomReason(true);
                } else {
                  setIsAddingCustomReason(false);
                }
              }}>
                <SelectTrigger className="w-full text-right" dir="rtl">
                  <SelectValue placeholder="בחר סיבה..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {settings?.rejection_reasons?.map((reason, idx) => (
                    <SelectItem key={idx} value={reason} className="text-right">{reason}</SelectItem>
                  ))}
                  <SelectItem value="אחר - הוסף חדש" className="text-right font-medium text-blue-600">+ סיבה חדשה</SelectItem>
                </SelectContent>
              </Select>

              {isAddingCustomReason && (
                <div className="space-y-2">
                  <Label>הזן סיבה חדשה:</Label>
                  <Input
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="לדוגמה: יקר מדי, מתחרים..."
                    className="text-right"
                  />
                  <p className="text-xs text-slate-500">סיבה זו תתווסף לרשימה באופן קבוע</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLostReasonDialogOpen(false)}>ביטול</Button>
              <Button onClick={handleSaveLostReason} className="bg-red-600 hover:bg-red-700 text-white">אישור ועדכון</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>מחיקת ליד</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>האם אתה בטוח שברצונך למחוק את הליד <strong>{leadToDelete?.customer_name}</strong>?</p>
              <p className="text-sm text-red-600 mt-2">פעולה זו לא ניתנת לביטול.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>ביטול</Button>
              <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">כן, מחק</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
