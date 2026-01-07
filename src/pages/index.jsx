
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
    Tasks, QuickTasks, Reports, Setup, Leads, ManageLeadSources, ChatBot, SystemHistory,
    CustomersPage, Jobs, Suppliers, Bot, Settings, Quotes, Employees, EmployeeDetails,
    Dashboard, SupplierOrders, Customers, CustomerDetails, Invoices, EmployeesNew, Catalog, RenewSubscription,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) url = url.slice(0, -1);
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) urlLastPart = urlLastPart.split('?')[0];
    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || 'Tasks';
}

function PagesContent({ user }) {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Layout currentPageName={currentPage} user={user}>
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

    // Consolidated auth check and listener
    React.useEffect(() => {
        let mounted = true;

        const syncUser = async (session) => {
            if (!mounted) return;

            if (session?.user) {
                console.log("Syncing user:", session.user.email);
                const basicUser = {
                    id: session.user.id,
                    email: session.user.email,
                    role_type: 'manager',
                };

                // Set basic user first
                setUser(prev => prev?.id === basicUser.id ? prev : basicUser);

                try {
                    const dbUser = await base44.auth.me();
                    if (mounted && dbUser) {
                        setUser(dbUser);
                    }
                } catch (err) {
                    console.warn("Could not enrich user:", err);
                }
            } else {
                console.log("No session, setting user to null");
                setUser(null);
            }

            setLoading(false);
        };

        // Initial check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) syncUser(session);
        });

        // Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth event:", event);
            if (mounted) {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    syncUser(session);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setLoading(false);
                }
            }
        });

        const timeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn("Auth timeout reached");
                setLoading(false);
            }
        }, 10000);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-slate-50 gap-4" dir="rtl">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <div className="text-slate-600 font-medium">מתחבר למערכת...</div>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <Router>
            <PagesContent user={user} />
        </Router>
    );
}
