import { requireUser } from "@/lib/session";
import { SettingsForm } from "@/components/auth/settings-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="Settings" />
      <SettingsForm user={{ name: user.name, email: user.email, timezone: user.timezone ?? "UTC", publicProfile: user.publicProfile ?? true }} />
    </div>
  );
}
