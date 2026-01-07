
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
    return pageName || Object.keys(PAGES)[0];
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

    React.useEffect(() => {
        let mounted = true;

        const checkUser = async () => {
            console.log("Starting Auth check...");

            // Timeout safety - don't stay stuck on spinner forever
            const timeout = setTimeout(() => {
                if (mounted && loading) {
                    console.warn("Auth check stalled, forcing loader off.");
                    setLoading(false);
                }
            }, 5000);

            try {
                // 1. Get Session directly immediately
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("Session error:", error);
                }

                if (session?.user && mounted) {
                    console.log("Session found for:", session.user.email);
                    // 2. Set basic user IMMEDIATELY found in session
                    const basicUser = {
                        id: session.user.id,
                        email: session.user.email,
                        role_type: 'manager',
                    };
                    setUser(basicUser);

                    // 3. Try to enrich with DB data in background
                    try {
                        const dbUser = await base44.auth.me();
                        if (mounted && dbUser) {
                            console.log("User enriched from DB");
                            setUser(dbUser);
                        }
                    } catch (dbError) {
                        console.warn("Could not fetch extra user details, staying with basic session user:", dbError);
                    }
                } else {
                    console.log("No proactive session found.");
                }
            } catch (err) {
                console.error("Critical Auth Error:", err.message);
            } finally {
                clearTimeout(timeout);
                if (mounted) {
                    console.log("Auth check complete, setting loading to false");
                    setLoading(false);
                }
            }
        };

        checkUser();

        // Listen for auth changes
        const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth state change:", event);
            if (event === 'SIGNED_IN' && session?.user && mounted) {
                setUser({
                    id: session.user.id,
                    email: session.user.email,
                    role_type: 'manager'
                });
            } else if (event === 'SIGNED_OUT') {
                if (mounted) setUser(null);
            }
        });

        return () => {
            mounted = false;
            listener?.subscription?.unsubscribe();
        };
 
