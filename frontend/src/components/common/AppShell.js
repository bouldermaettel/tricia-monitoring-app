import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, ClipboardList, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../app/auth';
export function AppShell({ children }) {
    const { pathname } = useLocation();
    const { session } = useAuth();
    const navItems = [
        { to: '/input', label: 'Input', icon: ClipboardList },
        { to: '/matrix', label: 'Matrix', icon: BarChart3 },
        { to: '/control', label: 'Control', icon: ShieldCheck },
        ...(session?.role === 'admin' ? [{ to: '/users', label: 'Users', icon: Users }] : []),
    ];
    return (_jsxs("div", { className: "min-h-screen bg-stone-50", children: [_jsx("header", { className: "bg-stone-900 text-white shadow-md", children: _jsxs("div", { className: "max-w-screen-xl mx-auto px-6 flex items-center gap-8 h-14", children: [_jsx("span", { className: "font-bold text-amber-400 tracking-tight text-base", children: "Tricia Monitor" }), _jsx("nav", { className: "flex gap-1", children: navItems.map(({ to, label, icon: Icon }) => {
                                const active = pathname.startsWith(to);
                                return (_jsxs(Link, { to: to, className: `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${active
                                        ? 'bg-amber-400 text-stone-900'
                                        : 'text-stone-300 hover:text-white hover:bg-stone-700'}`, children: [_jsx(Icon, { size: 15 }), label] }, to));
                            }) }), !session && (_jsx(Link, { to: "/login", className: "ml-auto text-sm text-stone-300 hover:text-white underline", children: "Sign In" }))] }) }), _jsx("main", { className: "max-w-screen-xl mx-auto px-6 py-8", children: children })] }));
}
