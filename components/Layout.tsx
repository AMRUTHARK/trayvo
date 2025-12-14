'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, clearAuth, isAdmin, isSuperAdmin, isCashier } from '@/lib/auth';
import CompanyLogo from '@/components/CompanyLogo';
import ShopLogo from '@/components/ShopLogo';
import toast from 'react-hot-toast';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  useEffect(() => {
    const storedUser = getStoredUser();
    const token = localStorage.getItem('token');
    
    if (!storedUser || !token) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  const menuItems = [
    ...(isSuperAdmin() ? [{ href: '/superadmin', label: 'Super Admin', icon: '👑' }] : []),
    ...(!isCashier() ? [{ href: '/dashboard', label: 'Dashboard', icon: '📊' }] : []),
    ...(!isSuperAdmin() ? [{ href: '/pos', label: 'POS Billing', icon: '🛒' }] : []),
    ...(!isCashier() ? [
      { href: '/products', label: 'Products', icon: '📦' },
      { href: '/categories', label: 'Categories', icon: '🏷️' },
      { href: '/inventory', label: 'Inventory', icon: '📋' },
    ] : []),
    { href: '/bills', label: 'Bills', icon: '🧾' },
    ...(!isCashier() ? [
      { href: '/purchases', label: 'Purchases', icon: '📥' },
      { href: '/reports', label: 'Reports', icon: '📈' },
    ] : []),
    ...(isAdmin() || isSuperAdmin() ? [{ href: '/settings', label: 'Settings', icon: '⚙️' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`fixed left-0 top-0 bottom-0 w-64 bg-white shadow-xl transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent menuItems={menuItems} pathname={pathname} user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <SidebarContent menuItems={menuItems} pathname={pathname} user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center space-x-4">
            {user.shop_name && (
              <div className="flex items-center space-x-3">
                {user.shop_logo_url ? (
                  <ShopLogo 
                    logoUrl={user.shop_logo_url} 
                    shopName={user.shop_name} 
                    size="sm" 
                    showText={true} 
                    className="" 
                  />
                ) : (
                  <ShopLogo 
                    logoUrl={null} 
                    shopName={user.shop_name} 
                    size="sm" 
                    showText={true} 
                    className="" 
                  />
                )}
                <span className="text-sm text-gray-400">|</span>
              </div>
            )}
            <span className="text-sm text-gray-600">{user.full_name || user.username}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              user.role === 'super_admin' 
                ? 'bg-purple-100 text-purple-800' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {user.role === 'super_admin' ? 'Super Admin' : user.role}
            </span>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  menuItems,
  pathname,
  user,
  onLogout,
}: {
  menuItems: any[];
  pathname: string;
  user: any;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-24 px-4 py-4" style={{ backgroundColor: 'rgb(74, 106, 177)' }}>
        <div className="w-full max-w-[300px]">
          {/* Always show Trayvo logo */}
          <div className="flex justify-center">
            <CompanyLogo size="md" showText={true} className="text-white" />
          </div>
        </div>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === item.href
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </>
  );
}

