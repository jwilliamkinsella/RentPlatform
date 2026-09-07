const express = require("express");
const Stripe = require("stripe");

module.exports = function stripeRentRoutes(pool) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // POST /api/stripe/rent/checkout-session
  // body: { tenancyTenantId, tenantUserId }
  router.post("/rent/checkout-session", async (req, res) => {
    try {
      const { tenancyTenantId, tenantUserId } = req.body;
      if (!tenancyTenantId || !tenantUserId) {
        return res.status(400).json({ error: "tenancyTenantId and tenantUserId required" });
      }

      const [rows] = await pool.execute(
        `
        SELECT
          tt.id AS tenancy_tenant_id,
          tt.tenancy_id,
          tt.tenant_id,
          tt.rent_share_amount,
          t.due_day,
          p.owner_id AS landlord_user_id,
          ul.stripe_account_id AS landlord_stripe_account_id,
          ul.stripe_payouts_enabled AS landlord_payouts_enabled,
          ul.stripe_charges_enabled AS landlord_charges_enabled,
          ut.stripe_customer_id AS tenant_stripe_customer_id
        FROM tenancy_tenants tt
        JOIN tenancies t ON t.tenancy_id = tt.tenancy_id
        JOIN properties p ON p.property_id = t.property_id
        JOIN users ul ON ul.user_id = p.owner_id
        JOIN users ut ON ut.user_id = tt.tenant_id
        WHERE tt.id = ? AND tt.tenant_id = ?
        LIMIT 1
        `,
        [tenancyTenantId, tenantUserId]
      );

      if (!rows.length) return res.status(404).json({ error: "Tenancy tenant not found" });

      const r = rows[0];

      if (!r.landlord_stripe_account_id) {
        return res.status(400).json({ error: "Landlord has not connected Stripe yet." });
      }

      if (!r.landlord_payouts_enabled || !r.landlord_charges_enabled) {
        return res.status(400).json({ error: "Landlord Stripe onboarding not complete yet." });
      }

      // Ensure tenant has a Stripe Customer
      let customerId = r.tenant_stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: { tenantUserId: String(tenantUserId) },
        });

        customerId = customer.id;

        await pool.execute(
          "UPDATE users SET stripe_customer_id = ? WHERE user_id = ?",
          [customerId, tenantUserId]
        );
      }

      const amountCents = Math.round(Number(r.rent_share_amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return res.status(400).json({ error: "Invalid rent_share_amount" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Monthly Rent",
                description: `Tenancy ${r.tenancy_id} (Tenant ${r.tenant_id})`,
              },
              unit_amount: amountCents,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          transfer_data: { destination: r.landlord_stripe_account_id },
          metadata: {
            tenancyTenantId: String(r.tenancy_tenant_id),
            tenancyId: String(r.tenancy_id),
            tenantUserId: String(r.tenant_id),
            landlordUserId: String(r.landlord_user_id),
          },
        },
        metadata: {
          tenancyTenantId: String(r.tenancy_tenant_id),
          tenancyId: String(r.tenancy_id),
          tenantUserId: String(r.tenant_id),
          landlordUserId: String(r.landlord_user_id),
        },
        success_url: `${process.env.APP_URL}/tenant-dashboard`,
        cancel_url: `${process.env.APP_URL}/tenant/payments/cancel`,
      });

      
      return res.json({ url: session.url });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  return router;
};
