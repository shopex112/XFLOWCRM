import React from "react";
import { base44, supabase } from "@/api/base44client";
import Login from "./login.jsx";
import Layout from "./layout.jsx";

import Tasks from "./tasks.jsx";
import QuickTasks from "./quicktasks.jsx";
import Reports from "./reports.jsx";
import Setup from "./setup.jsx";
import Leads from "./leads.jsx";
import ManageLeadSources from "./manageleadsources.jsx";
import ChatBot from "./chatbot.jsx";
import SystemHistory from "./systemhistory.jsx";
import CustomersPage from "./customerspage.jsx";
import Jobs from "./jobs.jsx";
import Suppliers from "./suppliers.jsx";
import Bot from "./bot.jsx";
import Settings from "./settings.jsx";
import Quotes from "./quotes.jsx";
import Employees from "./employees.jsx";
import EmployeeDetails from "./employeedetails.jsx";
import Dashboard from "./dashboard.jsx";
import SupplierOrders from "./supplierorders.jsx";
import Customers from "./customers.jsx";
import CustomerDetails from "./customerdetails.jsx";
import Invoices from "./invoices.jsx";
import EmployeesNew from "./employeesnew.jsx";
import Catalog from "./catalog.jsx";
import RenewSubscription from "./renewsubscription.jsx";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    Tasks: Tasks,
    QuickTasks: QuickTasks,
    Reports: Reports,
    Setup: Setup,
    Leads: Leads,
    ManageLeadSources: ManageLeadSources,
    ChatBot: ChatBot,
    SystemHistory: SystemHistory,
    CustomersPage: CustomersPage,
    Jobs: Jobs,
    Suppliers: Suppliers,
    Bot: Bot,
    Settings: Settings,
    Quotes: Quotes,
    Employees: Employees,
    EmployeeDetails: EmployeeDetails,
    Dashboard: Dashboard,
    SupplierOrders: SupplierOrders,
    Customers: Customers,
    CustomerDetails: CustomerDetails,
    Invoices: Invoices,
    EmployeesNew: EmployeesNew,
    Catalog: Catalog,
    RenewSubscription: RenewSubscription,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Layout currentPageName={currentPage}>
            <Routes>
                <Route path="/" element={<Tasks />} />
                <Route path="/Tasks" element={<Tasks />} />
                <Route path="/QuickTasks" element={<QuickTasks />} />
                <Route path="/Reports" element={<Reports />} />
                <Route path="/Setup" element={<Setup />} />
                <Route path="/Leads" element={<Leads />} />
                <Route path="/ManageLeadSources" element={<ManageLeadSources />} />
                <Route path="/ChatBot" element={<ChatBot />} />
                <Route path="/SystemHistory" element={<SystemHistory />} />
                <Route path="/CustomersPage" element={<CustomersPage />} />
                <Route path="/Jobs" element={<Jobs />} />
                <Route path="/Suppliers" element={<Suppliers />} />
                <Route path="/Bot" element={<Bot />} />
                <Route path="/Settings" element={<Settings />} />
                <Route path="/Quotes" element={<Quotes />} />
                <Route path="/Employees" element={<Employees />} />
                <Route path="/EmployeeDetails" element={<EmployeeDetails />} />
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/SupplierOrders" element={<SupplierOrders />} />
                <Route path="/Customers" element={<Customers />} />
                <Route path="/CustomerDetails" element={<CustomerDetails />} />
                <Route path="/Invoices" element={<Invoices />} />
                <Route path="/EmployeesNew" element={<EmployeesNew />} />
                <Route path="/Catalog" element={<Catalog />} />
                <Route path="/RenewSubscription" element={<RenewSubscription />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [authReady, setAuthReady] = React.useState(false);

    React.useEffect(() => {
        const checkUser = async () => {
            // Force timeout after 4 seconds if SDK hangs
            const timeoutId = setTimeout(() => {
                setLoading(false);
                setAuthReady(true);
            }, 4000);

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const userData = await base44.auth.me();
                    setUser(userData);
                }
            } catch (err) {
                console.error("Auth check failed:", err);
            } finally {
                clearTimeout(timeoutId);
                setLoading(false);
                setAuthReady(true);
            }
        };
        checkUser();

        const { data: authListener } = base44.supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const userData = await base44.auth.me();
                setUser(userData);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => {
            if (authListener && authListener.subscription) {
                authListener.subscription.unsubscribe();
            }
        };
    }, []);

    if (loading || !authReady) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
