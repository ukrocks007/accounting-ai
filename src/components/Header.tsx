'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function Header({ title, description, children }: HeaderProps) {
  const pathname = usePathname();

  const getNavigationLinks = () => {
    const links = [];
    
    if (pathname !== '/') {
      links.push(
        <Link
          key="home"
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          ← Back to Chat
        </Link>
      );
    }
    
    if (pathname !== '/statements') {
      links.push(
        <Link
          key="statements"
          href="/statements"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Manage Statements
        </Link>
      );
    }
    
    if (pathname !== '/admin/background-processing') {
      links.push(
        <Link
          key="admin"
          href="/admin/background-processing"
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          Admin Panel
        </Link>
      );
    }
    
    // if (pathname !== '/admin/sse-demo') {
    //   links.push(
    //     <Link
    //       key="sse-demo"
    //       href="/admin/sse-demo"
    //       className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
    //     >
    //       SSE Demo
    //     </Link>
    //   );
    // }
    
    // if (pathname !== '/admin/background-process-test') {
    //   links.push(
    //     <Link
    //       key="bg-test"
    //       href="/admin/background-process-test"
    //       className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
    //     >
    //       SSE Test
    //     </Link>
    //   );
    // }
    
    // if (pathname !== '/admin/ollama') {
    //   links.push(
    //     <Link
    //       key="ollama"
    //       href="/admin/ollama"
    //       className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
    //     >
    //       Ollama
    //     </Link>
    //   );
    // }
    
    return links;
  };

  return (
    <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-300">
      <div className="max-w-6xl mx-auto px-2 py-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            {description && (
              <p className="text-gray-600 text-sm">{description}</p>
            )}
          </div>
          <nav className="flex gap-4 items-center">
            {children}
            {getNavigationLinks()}
          </nav>
        </div>
      </div>
    </div>
  );
}
