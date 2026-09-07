import { api } from "../api/client";


export async function createRentCheckoutSession({ tenancyTenantId, tenantUserId, token }) {
  const res = await api.post(
    "/stripe/rent/checkout-session",
    { tenancyTenantId, tenantUserId },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.data?.url) throw new Error("No checkout URL returned from server");
  return res.data;
}

export async function getStripeConnectStatus({ landlordUserId, token }) {
  const res = await api.get(`/stripe/connect/status/${landlordUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.data;
}

export async function startStripeOnboarding({ landlordUserId, token }) {
  const res = await api.post(
    "/stripe/connect/onboard",
    { landlordUserId },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.data?.url) throw new Error("No Stripe onboarding URL returned");
  return res.data;
}