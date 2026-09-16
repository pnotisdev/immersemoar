import { requireUser } from "@/lib/session";
import { DeleteAccountDialog, ExportDataButton } from "@/components/auth/account-actions";
import { SettingsForm } from "@/components/auth/settings-form";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="Settings" />
      <SettingsForm
        user={{
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          timezone: user.timezone ?? "UTC",
          publicProfile: user.publicProfile ?? true,
          username: user.username ?? "",
          emailNotifications: user.emailNotifications ?? true,
        }}
      />

      <div className="mt-10 max-w-md">
        <SectionHeader title="Your data" />
        <p className="mb-3 text-sm text-muted-foreground">
          Download everything tied to your account — profile, sessions, library, goals, follows and club activity —
          as a JSON file.
        </p>
        <ExportDataButton />
      </div>

      <div className="mt-10 max-w-md">
        <SectionHeader title="Danger zone" />
        <p className="mb-3 text-sm text-muted-foreground">
          Permanently delete your account and everything associated with it. This cannot be undone.
        </p>
        <DeleteAccountDialog />
      </div>
    </div>
  );
}
