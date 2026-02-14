import type { ReactNode } from 'react';

interface EditorialLayoutProps {
  children: ReactNode;
}

export default function EditorialLayout({ children }: EditorialLayoutProps) {
  return (
    <div className="ed-app-layout">
      {children}
    </div>
  );
}
