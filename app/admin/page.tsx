import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata = {
  title: "Admin Login - RxLab Auth",
  description: "Admin access",
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();

  if (session.isAdmin) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <AdminLoginForm />
    </div>
  );
}
