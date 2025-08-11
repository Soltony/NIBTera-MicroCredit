'use client';

import React from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  Bell,
  FileText,
  ShieldCheck,
  LogOut,
  User,
  FileCog,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {Button} from '@/components/ui/button';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Logo} from '@/components/icons';
import {useLoanProviders} from '@/hooks/use-loan-providers';
import {AuthProvider, useAuth} from '@/hooks/use-auth';
import type { AuthenticatedUser } from '@/hooks/use-auth';

const allMenuItems = [
  {
    path: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['Super Admin', 'Loan Manager', 'Auditor', 'Loan Provider'],
  },
  {
    path: '/admin/access-control',
    label: 'Access Control',
    icon: ShieldCheck,
    roles: ['Super Admin'],
  },
  {
    path: '/admin/reports',
    label: 'Reports',
    icon: FileText,
    roles: ['Super Admin', 'Loan Manager', 'Auditor', 'Loan Provider'],
  },
  {
    path: '/admin/credit-score-engine',
    label: 'Scoring Engine',
    icon: FileCog,
    roles: ['Super Admin', 'Loan Manager'],
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['Super Admin', 'Loan Manager', 'Loan Provider'],
  },
];

function AuthWrapper({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const {providers} = useLoanProviders();
  const {currentUser, logout, isLoading} = useAuth();

  // If on the login page, don't render the protected layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const themeColor = React.useMemo(() => {
    if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
      return providers.find((p) => p.name === 'NIb Bank')?.colorHex || '#fdb913';
    }
    return (
      providers.find((p) => p.name === currentUser?.providerName)?.colorHex ||
      '#fdb913'
    );
  }, [currentUser, providers]);

  const getInitials = (name: string = '') =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('');

  const menuItems = React.useMemo(() => {
    if (!currentUser) return [];
    return allMenuItems.filter((item) =>
      item.roles.includes(currentUser.role as string)
    );
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading user data...</p>
      </div>
    );
  }

  if (!currentUser) {
    // This case should be handled by middleware, but as a fallback:
    return (
        <div className="flex items-center justify-center h-screen">
            <p>Redirecting to login...</p>
        </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="bg-muted/40 min-h-screen w-full flex">
        <Sidebar>
          <SidebarHeader>
            <SidebarTrigger>
              <Logo className="h-6 w-6" />
            </SidebarTrigger>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <Link href={item.path}>
                    <SidebarMenuButton
                      isActive={pathname === item.path}
                      tooltip={{
                        children: item.label,
                      }}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6 justify-end">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="sr-only">Toggle notifications</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="overflow-hidden rounded-full"
                >
                  <Avatar>
                    <AvatarImage
                      src={`https://github.com/shadcn.png`}
                      alt={currentUser?.fullName || ''}
                    />
                    <AvatarFallback>
                      {getInitials(currentUser?.fullName || '')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{currentUser?.fullName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main
            className="flex-1"
            style={{'--provider-color': themeColor} as React.CSSProperties}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminLayout({children}: {children: React.ReactNode}) {
  return (
    <AuthProvider>
      <AuthWrapper>{children}</AuthWrapper>
    </AuthProvider>
  );
}
