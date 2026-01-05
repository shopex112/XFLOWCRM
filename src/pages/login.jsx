import React, { useState } from 'react';
import { supabase } from '@/api/base44client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Mail, Building2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            toast({
                title: "התחברת בהצלחה",
                description: "ברוך הבא למערכת xFlow CRM",
            });

            // Redirect will be handled by the layout's auth check or simple reload
            window.location.reload();
        } catch (error) {
            console.error('Login error:', error);
            toast({
                title: "שגיאת התחברות",
                description: error.message === 'Invalid login credentials' ? 'אימייל או סיסמה שגויים' : error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100 p-4" dir="rtl">
            <Card className="w-full max-w-md shadow-2xl border-none">
                <CardHeader className="space-y-1 text-center pb-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
                            <Building2 className="w-10 h-10 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-extrabold text-slate-900">כניסה למערכת</CardTitle>
                    <CardDescription className="text-slate-500 font-medium">הזן פרטי גישה ל-xFlow CRM</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">אימייל</Label>
                            <div className="relative">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pr-10 h-12 border-slate-200 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">סיסמה</Label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pr-10 h-12 border-slate-200 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4 flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                                    מתחבר...
                                </>
                            ) : (
                                'התחברות'
                            )}
                        </Button>
                        <p className="text-center text-sm text-slate-500">
                            אין לך חשבון? <span className="text-blue-600 font-semibold cursor-default">פנה למנהל המערכת</span>
                        </p>
                    </CardFooter>
                </form>
            </Card>

            {/* Footer Branding */}
            <div className="fixed bottom-6 text-center w-full text-slate-400 text-xs">
                Powered by <span className="font-bold text-slate-600">xFlow CRM</span>
            </div>
        </div>
    );
}
