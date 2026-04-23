import { PropsWithChildren } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, ClipboardList, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../app/auth';

export function AppShell({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const { session } = useAuth();
  const navItems = [
    { to: '/input', label: 'Input', icon: ClipboardList },
    { to: '/matrix', label: 'Matrix', icon: BarChart3 },
    { to: '/control', label: 'Control', icon: ShieldCheck },
    ...(session?.role === 'admin' ? [{ to: '/users', label: 'Users', icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-stone-900 text-white shadow-md">
        <div className="max-w-screen-xl mx-auto px-6 flex items-center gap-8 h-14">
          <span className="font-bold text-amber-400 tracking-tight text-base">Tricia Monitor</span>
          <nav className="flex gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-400 text-stone-900'
                      : 'text-stone-300 hover:text-white hover:bg-stone-700'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>
          {!session && (
            <Link to="/login" className="ml-auto text-sm text-stone-300 hover:text-white underline">
              Sign In
            </Link>
          )}
        </div>
      </header>
      <main className="max-w-screen-xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
