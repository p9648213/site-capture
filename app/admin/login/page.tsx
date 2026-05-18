import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { AdminLoginForm } from "./admin-login-form";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <section className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-950">SiteCapture Admin</h1>
          <p className="mt-2 text-sm text-slate-600">Enter the master password to manage sites.</p>
        </div>
        <AdminLoginForm />
      </section>
    </main>
  );
}
