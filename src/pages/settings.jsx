import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Save, Loader2, Eye, GitBranch, CreditCard, Users, Shield, Edit, Building2, Upload, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const allModules = [
  { id: 'Leads', name: 'לידים' },
  { id: 'Quotes', name: 'הצעות מחיר' },
  { id: 'Jobs', name: 'עבודות' },
  { id: 'Tasks', name: 'המשימות שלי' },
  { id: 'Employees', name: 'עובדים' },
  { id: 'Inventory', name: 'מלאי' },
  { id: 'SupplierOrders', name: 'הזמנות מספקים'},
  { id: 'Suppliers', name: 'ספקים' },
  { id: 'Reports', name: 'דוחות' },
  { id: 'Bot', name: 'בוט' },
];

const PERMISSION_CATEGORIES = {
  "לידים": ["leads_view_all", "leads_create", "leads_edit", "leads_delete", "leads_view_prices", "leads_change_status"],
  "כספים": ["quotes_view", "quotes_create", "quotes_edit", "quotes_delete", "quotes_view_prices", "quotes_send", "quotes_create_payment_link", "invoices_view", "invoices_view_amounts", "invoices_delete", "payments_view", "payments_refund", "payments_manual_update"],
  "מלאי": ["inventory_view", "inventory_view_costs", "inventory_create", "inventory_edit", "inventory_delete", "inventory_update_stock", "suppliers_view", "suppliers_view_costs", "suppliers_create_order", "suppliers_edit", "suppliers_delete"],
  "עבודות": ["jobs_view_all", "jobs_change_status", "jobs_delete", "tasks_view_all", "tasks_create", "tasks_edit", "tasks_delete", "tasks_assign", "queue_manage", "assign_jobs_manual"],
  "לקוחות": ["customers_view_all", "customers_create", "customers_edit", "customers_delete", "communication_whatsapp", "communication_email", "communication_phone", "surveys_view"],
  "עובדים": ["employees_view_all", "employees_create", "employees_edit", "employees_delete", "employees_manage_permissions", "stats_view_others", "audit_view", "warranty_view", "warranty_create"],
  "דוחות": ["reports_view", "reports_view_financial", "stats_view_revenue", "stats_view_profit", "export_data", "print_documents"],
  "הגדרות": ["settings_access", "settings_integrations", "bot_access", "bot_configure", "templates_edit", "lead_sources_edit", "media_upload", "media_delete"]
};

// פונקציה לבדוק אם לעובד יש גישה לדף
const hasAccessToPage = (user, pageName) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  
  const permissions = user.permissions || {};
  
  switch(pageName) {
    case "Leads":
      return permissions.leads_view_all;
    case "Quotes":
      return permissions.quotes_view;
    case "Invoices":
      return permissions.invoices_view;
    case "Customers":
      return permissions.customers_view_all;
    case "Jobs":
      return permissions.jobs_view_all || permissions.jobs_change_status;
    case "Tasks":
      return true;
    case "Employees":
      return true;
    case "Inventory":
      return permissions.inventory_view;
    case "Suppliers":
      return permissions.suppliers_view;
    case "SupplierOrders":
      return permissions.suppliers_view;
    case "Reports":
      return permissions.reports_view;
    case "Bot":
      return permissions.bot_access;
    case "Settings":
      return permissions.settings_access;
    default:
      return false;
  }
};

const pagesList = [
  { id: 'Leads', name: 'לידים', icon: '📊' },
  { id: 'Quotes', name: 'הצעות', icon: '💰' },
  { id: 'Invoices', name: 'חשבוניות', icon: '🧾' },
  { id: 'Customers', name: 'לקוחות', icon: '👥' },
  { id: 'Jobs', name: 'עבודות', icon: '🔧' },
  { id: 'Tasks', name: 'משימות', icon: '✅' },
  { id: 'Employees', name: 'עובדים', icon: '👨‍💼' },
  { id: 'Inventory', name: 'מלאי', icon: '📦' },
  { id: 'Suppliers', name: 'ספקים', icon: '🏭' },
  { id: 'SupplierOrders', name: 'הזמנות', icon: '📋' },
  { id: 'Reports', name: 'דוחות', icon: '📈' },
  { id: 'Bot', name: 'בוט', icon: '🤖' },
  { id: 'Settings', name: 'הגדרות', icon: '⚙️' }
];

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const results = await base44.entities.Settings.list();
      return results[0] || {};
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    initialData: []
  });

  const [visibleModules, setVisibleModules] = useState([]);
  const [leadAssignment, setLeadAssignment] = useState({ auto_assign: true, assignment_method: 'round_robin' });
  const [cardcomSettings, setCardcomSettings] = useState({
    terminal_number: "",
    api_name: "",
    success_redirect_url: "",
    failed_redirect_url: "",
    webhook_url: ""
  });
  
  const [brandingSettings, setBrandingSettings] = useState({
    business_name: "",
    business_logo: ""
  });

  const [selectedRole, setSelectedRole] = useState("איש צוות");
  const [rolePermissions, setRolePermissions] = useState({});
  
  const [editingUser, setEditingUser] = useState(null);
  const [userPageAccess, setUserPageAccess] = useState({});

  useEffect(() => {
    if (settings) {
      setVisibleModules(settings.visible_modules || allModules.map(m => m.id));
      setLeadAssignment(settings.lead_assignment_rules || { auto_assign: true, assignment_method: 'round_robin' });
      setCardcomSettings(settings.cardcom_settings || {
        terminal_number: "",
        api_name: "",
        success_redirect_url: "",
        failed_redirect_url: "",
        webhook_url: ""
      });
      setBrandingSettings({
        business_name: settings.business_name || "",
        business_logo: settings.business_logo || ""
      });
    }
  }, [settings]);

  useEffect(() => {
    const usersInRole = users.filter(u => u.role_type === selectedRole);
    if (usersInRole.length > 0) {
      const firstUser = usersInRole[0];
      const perms = {};
      Object.keys(PERMISSION_CATEGORIES).forEach(cat => {
        const allPermsInCat = PERMISSION_CATEGORIES[cat];
        const enabledCount = allPermsInCat.filter(p => firstUser.permissions?.[p]).length;
        perms[cat] = enabledCount === allPermsInCat.length;
      });
      setRolePermissions(perms);
    }
  }, [selectedRole, users]);

  const updateMutation = useMutation({
    mutationFn: (newSettings) => {
      if (settings && settings.id) {
        return base44.entities.Settings.update(settings.id, newSettings);
      } else {
        return base44.entities.Settings.create(newSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: "✓ ההגדרות נשמרו בהצלחה!" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בשמירת הגדרות", description: error.message, variant: 'destructive' });
    }
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ role, permissions }) => {
      const usersInRole = users.filter(u => u.role_type === role);
      
      const fullPermissions = {};
      Object.keys(PERMISSION_CATEGORIES).forEach(cat => {
        PERMISSION_CATEGORIES[cat].forEach(perm => {
          fullPermissions[perm] = permissions[cat] || false;
        });
      });

      const updates = usersInRole.map(user => 
        base44.entities.User.update(user.id, { 
          ...user,
          permissions: fullPermissions 
        })
      );

      return Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const count = users.filter(u => u.role_type === variables.role).length;
      toast({ 
        title: `✓ עודכנו ${count} עובדים!`,
        description: `כל ה${variables.role}ים עודכנו בהצלחה`
      });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון הרשאות", description: error.message, variant: 'destructive' });
    }
  });

  const updateUserPermissionsMutation = useMutation({
    mutationFn: async ({ userId, pageAccess }) => {
      const user = users.find(u => u.id === userId);
      if (!user) throw new Error("User not found");
      
      const fullPermissions = { ...user.permissions };
      
      // עדכן הרשאות לפי גישה לדפים
      Object.keys(pageAccess).forEach(pageId => {
        const hasAccess = pageAccess[pageId];
        
        switch(pageId) {
          case "Leads":
            fullPermissions.leads_view_all = hasAccess;
            fullPermissions.leads_create = hasAccess;
            fullPermissions.leads_edit = hasAccess;
            break;
          case "Quotes":
            fullPermissions.quotes_view = hasAccess;
            fullPermissions.quotes_create = hasAccess;
            fullPermissions.quotes_edit = hasAccess;
            break;
          case "Invoices":
            fullPermissions.invoices_view = hasAccess;
            break;
          case "Customers":
            fullPermissions.customers_view_all = hasAccess;
            fullPermissions.customers_create = hasAccess;
            fullPermissions.customers_edit = hasAccess;
            break;
          case "Jobs":
            fullPermissions.jobs_view_all = hasAccess;
            fullPermissions.jobs_change_status = hasAccess;
            break;
          case "Inventory":
            fullPermissions.inventory_view = hasAccess;
            break;
          case "Suppliers":
            fullPermissions.suppliers_view = hasAccess;
            break;
          case "SupplierOrders":
            fullPermissions.suppliers_view = hasAccess;
            break;
          case "Reports":
            fullPermissions.reports_view = hasAccess;
            break;
          case "Bot":
            fullPermissions.bot_access = hasAccess;
            break;
          case "Settings":
            fullPermissions.settings_access = hasAccess;
            break;
        }
      });
      
      return base44.entities.User.update(userId, { permissions: fullPermissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      toast({ title: "✓ ההרשאות עודכנו!" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון", description: error.message, variant: 'destructive' });
    }
  });

  const handleSave = () => {
    updateMutation.mutate({
      visible_modules: visibleModules,
      lead_assignment_rules: leadAssignment,
      cardcom_settings: cardcomSettings,
      business_name: brandingSettings.business_name,
      business_logo: brandingSettings.business_logo
    });
  };

  const handleLogoUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setBrandingSettings({...brandingSettings, business_logo: file_url});
          toast({ title: "✓ הלוגו הועלה בהצלחה" });
        } catch (error) {
          toast({ title: "שגיאה בהעלאת לוגו", description: error.message, variant: "destructive" });
        }
      }
    };
    input.click();
  };

  const toggleModule = (moduleId) => {
    setVisibleModules(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleUpdateRolePermissions = () => {
    updateRolePermissionsMutation.mutate({ 
      role: selectedRole, 
      permissions: rolePermissions 
    });
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    const access = {};
    pagesList.forEach(page => {
      access[page.id] = hasAccessToPage(user, page.id);
    });
    setUserPageAccess(access);
  };

  const handleSaveUserPermissions = () => {
    updateUserPermissionsMutation.mutate({
      userId: editingUser.id,
      pageAccess: userPageAccess
    });
  };

  const usersInSelectedRole = users.filter(u => u.role_type === selectedRole);
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <SettingsIcon className="w-10 h-10 text-blue-600" />
              הגדרות מערכת
            </h1>
            <p className="text-slate-600">ניהול הגדרות ותצורות כלליות של המערכת</p>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            שמור שינויים
          </Button>
        </motion.div>

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-slate-100">
            <TabsTrigger value="branding"><Building2 className="w-4 h-4 ml-2" />מיתוג</TabsTrigger>
            <TabsTrigger value="overview"><Shield className="w-4 h-4 ml-2" />סקירת הרשאות</TabsTrigger>
            <TabsTrigger value="permissions"><Users className="w-4 h-4 ml-2" />הרשאות קבוצתיות</TabsTrigger>
            <TabsTrigger value="modules"><Eye className="w-4 h-4 ml-2"/>מודולים</TabsTrigger>
            <TabsTrigger value="leads"><GitBranch className="w-4 h-4 ml-2"/>לידים</TabsTrigger>
            <TabsTrigger value="cardcom"><CreditCard className="w-4 h-4 ml-2"/>Cardcom</TabsTrigger>
          </TabsList>

          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5"/>
                  מיתוג העסק
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="business_name" className="text-base font-semibold">שם העסק</Label>
                  <Input
                    id="business_name"
                    value={brandingSettings.business_name}
                    onChange={(e) => setBrandingSettings({...brandingSettings, business_name: e.target.value})}
                    placeholder="שם העסק שלך"
                    className="text-lg h-12"
                  />
                  <p className="text-sm text-slate-500">השם יוצג בתפריט הראשי ובראש העמוד</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-base font-semibold">לוגו העסק</Label>
                  <div className="flex items-center gap-4">
                    {brandingSettings.business_logo ? (
                      <div className="relative">
                        <img 
                          src={brandingSettings.business_logo} 
                          alt="לוגו העסק" 
                          className="w-20 h-20 object-contain rounded-xl border shadow-md bg-white"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                          onClick={() => setBrandingSettings({...brandingSettings, business_logo: ""})}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <Button onClick={handleLogoUpload} variant="outline" className="h-12">
                      <Upload className="w-4 h-4 ml-2" />
                      {brandingSettings.business_logo ? "החלף לוגו" : "העלה לוגו"}
                    </Button>
                  </div>
                  <p className="text-sm text-slate-500">הלוגו יוצג בתפריט הראשי (מומלץ: תמונה מרובעת)</p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-blue-900">💡 תצוגה מקדימה:</h4>
                  <div className="flex items-center gap-3 bg-white p-4 rounded-lg border">
                    {brandingSettings.business_logo ? (
                      <img src={brandingSettings.business_logo} alt="לוגו" className="w-10 h-10 object-contain rounded-xl" />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div>
                      <h2 className="font-bold text-slate-900 text-lg">{brandingSettings.business_name || "שם העסק"}</h2>
                      <p className="text-xs text-slate-500">מערכת ניהול</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-6 mt-6">
                  <h4 className="font-semibold mb-3 text-slate-700">קרדיט ויצירת קשר</h4>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm text-slate-600">
                    <p>
                      💬 <strong>רוצה מערכת כזו?</strong>{" "}
                      <a 
                        href={`https://wa.me/972553123658?text=${encodeURIComponent(`הגעתי מהמערכת של ${brandingSettings.business_name || 'העסק'} ואני רוצה לשמוע פרטים`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline font-medium"
                      >
                        השאר פרטים בוואטסאפ
                      </a>
                    </p>
                    <p>
                      🔧 פותח על ידי{" "}
                      <a 
                        href="https://xflow.co.il/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        xFlow CRM
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5"/>
                  סקירת גישה לדפים - כל העובדים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map(user => (
                    <Card key={user.id} className="border-2 hover:border-blue-300 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                              <span className="text-white font-bold">{user.full_name?.[0] || 'U'}</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900">{user.full_name}</h3>
                              <div className="flex items-center gap-2">
                                <Badge className="text-xs">
                                  {user.role_type === "בעלים" && "👑 בעלים"}
                                  {user.role_type === "מנכל" && "💼 מנכ\"ל"}
                                  {user.role_type === "מזכירה" && "📞 מזכירה"}
                                  {user.role_type === "איש צוות" && "🔧 איש צוות"}
                                  {user.role_type === "מחסנאי" && "📦 מחסנאי"}
                                  {user.role_type === "צופה" && "👀 צופה"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleEditUser(user)} className="bg-blue-600">
                            <Edit className="w-4 h-4 ml-2" />
                            ערוך הרשאות
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-4 md:grid-cols-7 lg:grid-cols-13 gap-2">
                          {pagesList.map(page => {
                            const hasAccess = hasAccessToPage(user, page.id);
                            return (
                              <div 
                                key={page.id} 
                                className={`p-2 rounded-lg text-center ${
                                  hasAccess 
                                    ? 'bg-green-50 border border-green-200' 
                                    : 'bg-slate-50 border border-slate-200'
                                }`}
                              >
                                <div className="text-2xl mb-1">{page.icon}</div>
                                <div className="text-xs font-medium text-slate-700">{page.name}</div>
                                <div className="text-lg mt-1">
                                  {hasAccess ? '✅' : '❌'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold mb-2 text-blue-900">💡 מקרא:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-800">
                    <div>✅ = יש גישה לדף</div>
                    <div>❌ = אין גישה לדף</div>
                    <div>🟢 ירוק = הרשאה פעילה</div>
                    <div>⚪ אפור = הרשאה לא פעילה</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5"/>
                  ניהול הרשאות לפי תפקיד
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">בחר תפקיד:</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="בעלים">👑 בעלים</SelectItem>
                      <SelectItem value="מנכל">💼 מנכ"ל</SelectItem>
                      <SelectItem value="מזכירה">📞 מזכירה</SelectItem>
                      <SelectItem value="איש צוות">🔧 איש צוות</SelectItem>
                      <SelectItem value="מחסנאי">📦 מחסנאי</SelectItem>
                      <SelectItem value="צופה">👀 צופה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  💡 שינוי זה ישפיע על <strong>{usersInSelectedRole.length}</strong> {selectedRole}ים במערכת
                </div>

                <div className="space-y-3">
                  {Object.keys(PERMISSION_CATEGORIES).map(category => (
                    <div key={category} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-slate-50 transition-colors">
                      <Label htmlFor={category} className="text-base font-medium cursor-pointer">
                        {category === "לידים" && "📊"} 
                        {category === "כספים" && "💰"} 
                        {category === "מלאי" && "📦"} 
                        {category === "עבודות" && "🔧"} 
                        {category === "לקוחות" && "👥"} 
                        {category === "עובדים" && "👨‍💼"} 
                        {category === "דוחות" && "📈"} 
                        {category === "הגדרות" && "⚙️"} 
                        {" "}{category}
                      </Label>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">
                          {rolePermissions[category] ? "כן" : "לא"}
                        </span>
                        <Switch
                          id={category}
                          checked={rolePermissions[category] || false}
                          onCheckedChange={(checked) => setRolePermissions({...rolePermissions, [category]: checked})}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={handleUpdateRolePermissions} 
                  disabled={updateRolePermissionsMutation.isPending || usersInSelectedRole.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                >
                  {updateRolePermissionsMutation.isPending ? (
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  ) : (
                    <>
                      💾 עדכן את כל ה{selectedRole}ים ({usersInSelectedRole.length})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Eye/> מודולים גלויים</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {allModules.map(module => (
                  <div key={module.id} className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                    <Label htmlFor={module.id} className="text-sm font-medium">{module.name}</Label>
                    <Switch
                      id={module.id}
                      checked={visibleModules.includes(module.id)}
                      onCheckedChange={() => toggleModule(module.id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><GitBranch /> חוקי שיבוץ לידים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                  <Label htmlFor="auto-assign" className="text-sm font-medium">שבץ לידים אוטומטית</Label>
                  <Switch
                    id="auto-assign"
                    checked={leadAssignment.auto_assign}
                    onCheckedChange={(checked) => setLeadAssignment(prev => ({...prev, auto_assign: checked}))}
                  />
                </div>
                {leadAssignment.auto_assign && (
                  <div className="space-y-2">
                    <Label>שיטת שיבוץ</Label>
                    <Select 
                      value={leadAssignment.assignment_method}
                      onValueChange={(value) => setLeadAssignment(prev => ({...prev, assignment_method: value}))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">סבב רוטציה</SelectItem>
                        <SelectItem value="available_installer">שבץ לאיש צוות פנוי (או לפי סבב)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cardcom">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard /> הגדרות Cardcom</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="terminal_number">מספר טרמינל (TerminalNumber)</Label>
                  <Input
                    id="terminal_number"
                    value={cardcomSettings.terminal_number}
                    onChange={(e) => setCardcomSettings({...cardcomSettings, terminal_number: e.target.value})}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_name">שם API (ApiName)</Label>
                  <Input
                    id="api_name"
                    value={cardcomSettings.api_name}
                    onChange={(e) => setCardcomSettings({...cardcomSettings, api_name: e.target.value})}
                    placeholder="cardtest1994"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="success_redirect">URL הצלחה (SuccessRedirectUrl)</Label>
                  <Input
                    id="success_redirect"
                    value={cardcomSettings.success_redirect_url}
                    onChange={(e) => setCardcomSettings({...cardcomSettings, success_redirect_url: e.target.value})}
                    placeholder="https://www.example.com/success"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="failed_redirect">URL כישלון (FailedRedirectUrl)</Label>
                  <Input
                    id="failed_redirect"
                    value={cardcomSettings.failed_redirect_url}
                    onChange={(e) => setCardcomSettings({...cardcomSettings, failed_redirect_url: e.target.value})}
                    placeholder="https://www.example.com/failed"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    value={cardcomSettings.webhook_url}
                    onChange={(e) => setCardcomSettings({...cardcomSettings, webhook_url: e.target.value})}
                    placeholder="https://hook.eu2.make.com/..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog לעריכת הרשאות עובד */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                עריכת הרשאות - {editingUser?.full_name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
              {pagesList.map(page => (
                <div 
                  key={page.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    userPageAccess[page.id]
                      ? 'bg-green-50 border-green-500 shadow-md'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setUserPageAccess({...userPageAccess, [page.id]: !userPageAccess[page.id]})}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">{page.icon}</div>
                    <div className="font-medium text-sm mb-2">{page.name}</div>
                    <div className="text-2xl">
                      {userPageAccess[page.id] ? '✅' : '❌'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                ביטול
              </Button>
              <Button 
                onClick={handleSaveUserPermissions} 
                disabled={updateUserPermissionsMutation.isPending}
                className="bg-blue-600"
              >
                {updateUserPermissionsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <>
                    💾 שמור שינויים
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}