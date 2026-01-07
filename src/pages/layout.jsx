
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users,
  Car,
  CheckSquare,
  Menu,
  X,
  BarChart3,
  LogOut,
  TrendingUp,
  MessageCircle,
  Shield,
  FileText,
  Settings,
  ClipboardList,
  Truck,
  Building2,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44client";
import { Toaster } from "@/components/ui/toaster";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import SubscriptionBell from "@/components/subscriptionbell";

// פונקציית עזר - בדיקת הרשאה
const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions?.[permission] === true;
};

export default function Layout({ children, user: propUser }) {
  const location = useLocation();
  const [newJobsCount, setNewJobsCount] = useState(0);
  const [businessSettings, setBusinessSettings] = useState({ business_name: "", business_logo: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const user = propUser;

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus) => base44.auth.updateMe({ availability_status: newStatus }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['currentUser'], updatedUser);
      toast({ title: "✓ הסטטוס עודכן" });
    },
    onError: () => {
      toast({ title: "שגיאה בעדכון סטטוס", variant: "destructive" });
    }
  });

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      try {
        const res = await base44.entities.Job.list();
        return Array.isArray(res) ? res : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!user && user.role_type === "איש צוות",
    refetchInterval: 60000,
    retry: false,
  });

  React.useEffect(() => {
    if (user && user.role_type === "איש צוות" && jobs && jobs.length > 0) {
      const myNewJobs = jobs.filter(j =>
        j.installer_email === user.email &&
        j.status === "פתוח"
      );
      setNewJobsCount(myNewJobs.length);
    } else {
      setNewJobsCount(0);
    }
  }, [jobs, user]);

  const { data: settingsData } = useQuery({
    queryKey: ['businessSettings'],
    queryFn: async () => {
      try {
        const res = await base44.entities.Settings.list();
        return Array.isArray(res) ? res : [];
      } catch (e) {
        return [];
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (settingsData && settingsData[0]) {
      setBusinessSettings({
        business_name: settingsData[0].business_name || "",
        business_logo: settingsData[0].business_logo || ""
      });
    }
  }, [settingsData]);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleStatusToggle = () => {
    if (user.availability_status === "בחופש") {
      updateStatusMutation.mutate("פנוי");
    } else {
      updateStatusMutation.mutate("בחופש");
    }
  };

  // בניית תפריט דינמי לפי הרשאות
  const getNavigationItems = () => {
    if (!user) return [];

    const items = [];

    // לידים
    if (hasPermission(user, 'leads_view_all') || user.role === "admin") {
      items.push({ title: "לידים", url: createPageUrl("Leads"), icon: TrendingUp });
    }

    // הצעות מחיר
    if (hasPermission(user, 'quotes_view') || user.role === "admin") {
      items.push({ title: "הצעות מחיר", url: createPageUrl("Quotes"), icon: FileText });
    }

    // חשבוניות
    if (hasPermission(user, 'invoices_view') || user.role === "admin") {
      items.push({ title: "חשבוניות", url: createPageUrl("Invoices"), icon: FileText });
    }

    // לקוחות
    if (hasPermission(user, 'customers_view_all') || user.role === "admin") {
      items.push({ title: "לקוחות", url: createPageUrl("Customers"), icon: Users });
    }

    // עבודות
    if (hasPermission(user, 'jobs_view_all') || hasPermission(user, 'jobs_change_status') || user.role === "admin") {
      items.push({ title: "עבודות", url: createPageUrl("Jobs"), icon: CheckSquare });
    }

    // המשימות שלי - כולם יכולים לראות את המשימות שלהם
    items.push({ title: "המשימות שלי", url: createPageUrl("Tasks"), icon: ClipboardList });

    // עובדים - כולם יכולים לראות את עצמם
    items.push({ title: "עובדים", url: createPageUrl("Employees"), icon: Users });

    // קטלוג (לשעבר מלאי)
    if (hasPermission(user, 'inventory_view') || user.role === "admin") {
      items.push({ title: "קטלוג", url: createPageUrl("Catalog"), icon: Car });
    }

    // הזמנות מספקים
    if (hasPermission(user, 'suppliers_view') || user.role === "admin") {
      items.push({ title: "הזמנות מספקים", url: createPageUrl("SupplierOrders"), icon: Truck });
    }

    // ספקים
    if (hasPermission(user, 'suppliers_view') || user.role === "admin") {
      items.push({ title: "ספקים", url: createPageUrl("Suppliers"), icon: Users });
    }

    // דוחות
    if (hasPermission(user, 'reports_view') || user.role === "admin") {
      items.push({ title: "דוחות", url: createPageUrl("Reports"), icon: BarChart3 });
    }

    // בוט
    if (hasPermission(user, 'bot_access') || user.role === "admin") {
      items.push({ title: "🤖 סוכן חכם", url: createPageUrl("ChatBot"), icon: Sparkles, highlight: true });
    }

    // הגדרות מנהל
    if (hasPermission(user, 'settings_access') || user.role === "admin") {
      items.push({ title: "הגדרות מנהל", url: createPageUrl("Settings"), icon: Settings });
    }

    return items;
  };

  const navigationItems = getNavigationItems();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50" dir="rtl">
        <Sidebar side="right" className="border-r border-slate-200 bg-white shadow-2xl" collapsible="offcanvas">
          <SidebarHeader className="border-b border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {businessSettings.business_logo ? (
                  <img src={businessSettings.business_logo} alt="לוגו" className="w-10 h-10 object-contain rounded-xl shadow-md" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">{businessSettings.business_name || "CRM"}</h2>
                  <p className="text-xs text-slate-500">מערכת ניהול</p>
                </div>
              </div>
              <SidebarTrigger className="lg:hidden hover:bg-slate-100 p-2 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </SidebarTrigger>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 mb-1">
                תפריט ראשי
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems
                    .sort((a, b) => {
                      const aIsAdminItem = a.icon === Shield || a.icon === Settings;
                      const bIsAdminItem = b.icon === Shield || b.icon === Settings;

                      if (aIsAdminItem && !bIsAdminItem) return 1;
                      if (!aIsAdminItem && bIsAdminItem) return -1;
                      return 0;
                    })
                    .map((item) => {
                      const isActive = location.pathname === item.url;
                      const ItemIcon = item.icon;

                      return (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={`
                              group relative overflow-hidden transition-all duration-200
                              ${isActive
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200 hover:shadow-xl'
                                : 'hover:bg-slate-50 text-slate-700 hover:text-blue-600'
                              }
                            `}
                          >
                            <Link to={item.url} className="flex items-center gap-3 px-4 py-3 rounded-xl">
                              <ItemIcon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-blue-600'}`} />
                              <span className="font-medium">{item.title}</span>
                              {item.badge && (
                                <Badge className="mr-auto bg-red-500 text-white text-xs px-2 py-0.5">
                                  {item.badge}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-100 p-4">
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white font-bold text-sm">
                      {user?.full_name?.[0] || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {user?.full_name || 'משתמש'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
                  </div>
                </div>
                {user && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border">
                      <span className="text-sm font-medium">
                        {user.availability_status === "פנוי" && "🟢 פנוי"}
                        {user.availability_status === "בעבודה" && "🟡 בעבודה"}
                        {user.availability_status === "בחופש" && "🔴 בחופש"}
                      </span>
                      {user.availability_status !== "בעבודה" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleStatusToggle}
                          className="h-7 text-xs"
                        >
                          {user.availability_status === "בחופש" ? "חזרתי" : "בחופש"}
                        </Button>
                      )}
                    </div>
                    {user.availability_status === "בעבודה" && (
                      <p className="text-xs text-slate-500 text-center">
                        הסטטוס ישתנה אוטומטי בסיום העבודה
                      </p>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                <span>יציאה</span>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 px-2 sm:px-4 md:px-6 py-2 md:py-3 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-2 md:gap-3 min-w-0 flex-1">
                <SidebarTrigger className="hover:bg-slate-100 active:bg-slate-200 p-3 rounded-lg transition-colors touch-manipulation flex-shrink-0">
                  <Menu className="w-6 h-6 text-slate-700" />
                </SidebarTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  {businessSettings.business_logo ? (
                    <img src={businessSettings.business_logo} alt="לוגו" className="w-8 h-8 md:w-10 md:h-10 object-contain rounded-lg shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                      <Building2 className="w-4 h-4 md:w-6 md:h-6 text-white" />
                    </div>
                  )}
                  <div className="hidden xs:block min-w-0">
                    <h1 className="text-sm sm:text-base md:text-xl font-bold text-slate-900 truncate">{businessSettings.business_name || "CRM"}</h1>
                    <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">מערכת ניהול</p>
                  </div>
                </div>
              </div>

              {user && <div className="flex-shrink-0"><SubscriptionBell subscriptionEndDate={user.subscription_end_date} /></div>}
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 px-4 py-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm">
              <a
                href={`https://wa.me/972553123658?text=${encodeURIComponent(`הגעתי מהמערכת של ${businessSettings.business_name || 'העסק'} ואני רוצה לשמוע פרטים`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
              >
                💬 רוצה מערכת כזו? השאר פרטים בוואטסאפ
              </a>
              <a
                href="https://xflow.co.il/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-blue-600 transition-colors"
              >
                פותח על ידי <span className="font-semibold">xFlow CRM</span>
              </a>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
