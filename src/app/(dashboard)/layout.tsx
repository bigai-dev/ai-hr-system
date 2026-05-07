import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // BASIC_AUTH_USER is the only identity in this app right now (HTTP Basic
  // single-user auth). Reading it server-side and passing as a prop avoids
  // the client trying to access process.env.
  const userName = process.env.BASIC_AUTH_USER ?? 'admin';
  return (
    <div className="flex min-h-screen">
      <Sidebar userName={userName} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
