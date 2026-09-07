const express = require("express");
const Stripe = require("stripe");


//Stripe (2026b). Connect Webhooks. [online] Stripe.com. Available at: https://docs.stripe.com/connect/webhooks [Accessed 10 Feb. 2026]. This document covers what webhooks are, they describe that it is used to provide the update details for your information. Meaning it acts as a source of truth for your database. 

module.exports = function stripeWebhookRoutes(pool) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  router.post("/", async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent( 
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET // Verify webhook signature to ensure the event was sent by Stripe. The Orange Club (2024). What is Webhook Secret Key in Stripe and How does it work? [online] The Orange Club. Available at: https://theorangeclub.me/webhook-secret-key-in-stripe [Accessed 10 Feb. 2026]. Discusses why the stripe webhook secret is needed and why store it in a non client side code file like .env 
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        // Landlord onboarding status updates, event.tyoe lets the different events that can occur to be processed depending on what has happened. 
        case "account.updated": {
          const acct = event.data.object;
          const requirementsDue = acct?.requirements?.currently_due ?? [];
          if (!acct?.id) break;

          await pool.execute( // once the message for account.updated is received my table for users is updated reflecting the stripe data that was created such as the status of account creation. 
            `
            UPDATE users
            SET
              stripe_charges_enabled = ?,
              stripe_payouts_enabled = ?,
              stripe_details_submitted = ?,
              stripe_onboarding_status = ?,
              stripe_requirements_due = ?
            WHERE stripe_account_id = ?
            `,
            [
              acct?.charges_enabled ? 1 : 0,
              acct?.payouts_enabled ? 1 : 0,
              acct?.details_submitted ? 1 : 0,
              acct?.charges_enabled && acct?.payouts_enabled ? "complete" : "pending", 
              JSON.stringify(requirementsDue),
              acct.id,
            ] // Stripe sends the information and I save it in Boolean format, then i take the charges enabled and payouts enabled and simplify for the UI if its complete or pending 
          );
          break;
        }

        // Tenant completes Checkout (subscription created)
        case "checkout.session.completed": {
          const session = event.data.object;

          if (session?.mode === "subscription" && session?.subscription) {
            const tenancyTenantId = session?.metadata?.tenancyTenantId ?? null;

            if (!tenancyTenantId) {
              console.warn("checkout.session.completed missing tenancyTenantId metadata", {
                eventId: event.id,
                sessionId: session?.id,
              });
              break;
            }

            await pool.execute(
              `
              UPDATE tenancy_tenants
              SET stripe_subscription_id = ?, stripe_subscription_status = 'active'
              WHERE id = ?
              `,
              [session.subscription, tenancyTenantId]
            );
          }
          break;
        }

        // Subscription status changes
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const tenancyTenantId = sub?.metadata?.tenancyTenantId ?? null;

          if (!tenancyTenantId) {
            console.warn("subscription event missing tenancyTenantId metadata", {
              eventType: event.type,
              eventId: event.id,
              subscriptionId: sub?.id,
              metadata: sub?.metadata,
            });
            break;
          }

          await pool.execute(
            `
            UPDATE tenancy_tenants
            SET stripe_subscription_id = ?, stripe_subscription_status = ?
            WHERE id = ?
            `,
            [sub.id, sub?.status ?? "unknown", tenancyTenantId]
          );
          break;
        }

        // Payment success
        case "invoice.paid":
        case "invoice.payment_succeeded":
        case "invoice_payment.paid": {
          const invoiceObj = event.data.object;

          const invoiceId =
            invoiceObj?.object === "invoice_payment" ? invoiceObj?.invoice : invoiceObj?.id;

          if (!invoiceId) {
            console.warn("SKIP: no invoice id", { eventType: event.type, eventId: event.id });
            break;
          }

         
          const invoice = await stripe.invoices.retrieve(invoiceId, {
            expand: ["subscription", "payment_intent", "charge", "customer", "lines"],
          });

          // Pull core fields 
          let subId = invoice?.subscription?.id ?? invoice?.subscription ?? null;
          const payIntentId = invoice?.payment_intent?.id ?? invoice?.payment_intent ?? null;
          const chargeId = invoice?.charge?.id ?? invoice?.charge ?? null;

          
          const metaTenancyTenantId = // This variable is storing the invoices data that is from the tenant, such as the TTid and the amount etc. 
            invoice?.subscription_details?.metadata?.tenancyTenantId ??
            invoice?.metadata?.tenancyTenantId ??
            invoice?.lines?.data?.[0]?.metadata?.tenancyTenantId ??
            null;

          // Customer id (best fallback)
          const customerId = invoice?.customer?.id ?? invoice?.customer ?? null;

          console.log("FULL INVOICE FETCHED:", {
            eventType: event.type,
            invoiceId,
            subId,
            payIntentId,
            chargeId,
            customerId,
            metaTenancyTenantId,
            amount_paid: invoice?.amount_paid,
            currency: invoice?.currency,
          });

          // This sections helps to avoid double database entries, so if the payment ID already exists exists in where a stripe invoice or event ID does where there is only 1 it will not repeat - adapted from chatGPT OpenAI (2026). ChatGPT - Stripe Webhook Idempotency. [online] ChatGPT. Available at: https://chatgpt.com/share/6998e4c8-8c70-8003-a96d-0ecd24e15f37 [Accessed 11 Feb. 2026].
          const [invoiceExists] = await pool.execute(
            "SELECT payment_id FROM payments WHERE stripe_invoice_id = ? LIMIT 1",
            [invoiceId]
          );
          if (invoiceExists.length) break;

          const [eventExists] = await pool.execute(
            "SELECT payment_id FROM payments WHERE stripe_event_id = ? LIMIT 1",
            [event.id]
          );
          if (eventExists.length) break;
          // Getting the tenancy tenant details is needed to cross reference the TTid and the Stripe subscription ID so it can use the join code, it will connect and map the tenant to the correct landlord so payments can be made 
          // Find tenancy_tenants row
          let ttRows = [];

          // If invoice carries tenancyTenantId metadata
          if (metaTenancyTenantId) {
            [ttRows] = await pool.execute(
              "SELECT id, tenancy_id, tenant_id FROM tenancy_tenants WHERE id = ? LIMIT 1",
              [metaTenancyTenantId]
            );
          }

          // If we have a subscription id, map by stripe_subscription_id
          if (!ttRows.length && subId) {
            [ttRows] = await pool.execute(
              "SELECT id, tenancy_id, tenant_id FROM tenancy_tenants WHERE stripe_subscription_id = ? LIMIT 1",
              [subId]
            );
          }

          // Fallback: map by invoice.customer - users - tenancy_tenants
          if (!ttRows.length && customerId) {
            const [uRows] = await pool.execute(
              "SELECT user_id FROM users WHERE stripe_customer_id = ? LIMIT 1",
              [customerId]
            );

            if (uRows.length) {
              const tenantUserId = uRows[0].user_id;

              // Pick the tenant’s active/latest tenancy slot
              [ttRows] = await pool.execute(
                `
                SELECT id, tenancy_id, tenant_id
                FROM tenancy_tenants
                WHERE tenant_id = ?
                ORDER BY id DESC
                LIMIT 1
                `,
                [tenantUserId]
              );
            }
          }

          if (!ttRows.length) {
            console.warn("SKIP: couldn't map invoice to tenancy_tenants", {
              invoiceId,
              subId,
              customerId,
              metaTenancyTenantId,
            });
            break;
          }

          const tt = ttRows[0];

          const amountCents = invoice?.amount_paid ?? invoice?.amount_due ?? 0;
          const amount = Number(amountCents) / 100;
          const currency = String(invoice?.currency ?? "eur").toUpperCase();
          const receiptUrl = invoice?.hosted_invoice_url ?? invoice?.invoice_pdf ?? null;

          await pool.execute(
            `
            INSERT INTO payments
              (tenancy_id, amount, payment_date, method, status, receipt_url, created_at,
              stripe_payment_intent_id, stripe_invoice_id, stripe_charge_id, stripe_event_id, currency,
              tenant_id, tenancy_tenant_id)
            VALUES
              (?, ?, NOW(), 'card', 'succeeded', ?, NOW(),
              ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              tt.tenancy_id, // originally was not tt for tenancy tenant, so it was not writing to the payment table as it did not have the ID
              Number.isFinite(amount) ? amount : 0,
              receiptUrl,
              payIntentId, 
              invoiceId,
              chargeId, 
              event.id,
              currency,
              tt.tenant_id,
              tt.id,
            ]
          );

          console.log("Payment inserted:", invoiceId); // issue where payment was not writing to the payment table, OpenAI (2026a). ChatGPT - Stripe Payment Webhook Issue. [online] ChatGPT. Available at: https://chatgpt.com/share/6998e99a-e764-8003-b022-db32b6d33902 [Accessed 15 Feb. 2026].
          break;
        }


        default:
          break;
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      return res.status(500).send("Webhook handler failed");
    }
  });

  return router;
};
