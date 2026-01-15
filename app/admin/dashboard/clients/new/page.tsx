import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClientForm } from "@/components/admin/client-form";

export const metadata = {
  title: "New OAuth Client - Admin",
  description: "Create a new OAuth client application",
};

export default function NewClientPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create OAuth Client</CardTitle>
        <CardDescription>
          Register a new application that can use OAuth to authenticate users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ClientForm />
      </CardContent>
    </Card>
  );
}
