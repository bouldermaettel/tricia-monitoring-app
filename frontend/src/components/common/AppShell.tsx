import { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div>
      <nav>
        <Link to="/input">Input</Link>
        <Link to="/matrix">Matrix</Link>
        <Link to="/control">Control</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
