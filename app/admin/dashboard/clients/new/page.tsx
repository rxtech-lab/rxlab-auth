import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ClientForm } from "@/components/admin/client-form";
import { OAuthEndpointsCard } from "@/components/admin/oauth-endpoints-card";
import { getOpenIDConfiguration } from "@/lib/oauth/discovery";

export const metadata = {
  title: "New OAuth Client - Admin",
  description: "Create a new OAuth client application",
};

export default function NewClientPage() {
  const config = getOpenIDConfiguration();

  const endpoints = {
    issuer: config.issuer,
    authorizationEndpoint: config.authorization_endpoint,
    tokenEndpoint: config.token_endpoint,
    discoveryUrl: `${config.issuer}/.well-known/openid-configuration`,
  };

  return (
    <div className="space-y-6">
      <OAuthEndpointsCard endpoints={endpoints} />

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
    </div>
  );
}
