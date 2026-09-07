const express = require("express");
const Stripe = require("stripe");

module.exports = function stripeConnectRoutes(pool) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // GET /api/stripe/connect/status/:landlordUserId
  // Returns whether Stripe is connected + whether onboarding is complete.
  router.get("/connect/status/:landlordUserId", async (req, res) => {
    try {
      const landlordUserId = Number(req.params.landlordUserId);
      if (!landlordUserId) {
        return res.status(400).json({ error: "Invalid landlordUserId" });
      }

      const [rows] = await pool.execute(
        `SELECT user_id, role, stripe_account_id, stripe_payouts_enabled, stripe_charges_enabled, stripe_onboarding_status
         FROM users
         WHERE user_id = ?
         LIMIT 1`,
        [landlordUserId]
      );

      if (!rows.length) return res.status(404).json({ error: "User not found" });
      if (rows[0].role !== "landlord") return res.status(403).json({ error: "User is not a landlord" });

      const u = rows[0];

      // If no account yet, send "not connected" response
      if (!u.stripe_account_id) {
        return res.json({
          connected: false,
          stripe_account_id: null,
          payouts_enabled: false,
          charges_enabled: false,
          onboarding_status: u.stripe_onboarding_status || "not_started",
        });
      }

      // Pull live status from Stripe + sync to DB 
      const acct = await stripe.accounts.retrieve(u.stripe_account_id);

      const payoutsEnabled = !!acct.payouts_enabled;
      const chargesEnabled = !!acct.charges_enabled;

      await pool.execute(
        `UPDATE users
         SET stripe_payouts_enabled = ?, stripe_charges_enabled = ?,
             stripe_onboarding_status = ?
         WHERE user_id = ?`,
        [
          payoutsEnabled ? 1 : 0,
          chargesEnabled ? 1 : 0,
          payoutsEnabled && chargesEnabled ? "complete" : "pending",
          landlordUserId,
        ]
      );

      return res.json({
        connected: true,
        stripe_account_id: u.stripe_account_id,
        payouts_enabled: payoutsEnabled,
        charges_enabled: chargesEnabled,
        onboarding_status: payoutsEnabled && chargesEnabled ? "complete" : "pending",
      });
    } catch (err) {
      console.error("CONNECT STATUS error:", err);
      return res.status(500).json({ error: "Failed to get Stripe connect status" });
    }
  });

  // POST /api/stripe/connect/onboard
  // body: { landlordUserId }
  router.post("/connect/onboard", async (req, res) => {
    try {
      const { landlordUserId } = req.body;
      if (!landlordUserId) {
        return res.status(400).json({ error: "landlordUserId required" });
      }

      const [rows] = await pool.execute(
        "SELECT user_id, email, stripe_account_id, role FROM users WHERE user_id = ? LIMIT 1",
        [landlordUserId]
      );

      if (!rows.length) return res.status(404).json({ error: "User not found" });
      if (rows[0].role !== "landlord") return res.status(403).json({ error: "User is not a landlord" });

      let accountId = rows[0].stripe_account_id;

      // Create Express connected account if needed
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          email: rows[0].email || undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });

        accountId = account.id;

        await pool.execute(
          "UPDATE users SET stripe_account_id = ?, stripe_onboarding_status = 'pending' WHERE user_id = ?",
          [accountId, landlordUserId]
        );
      }

      // Create onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.APP_URL}/landlord-dashboard`,
        return_url: `${process.env.APP_URL}/landlord-dashboard`,
        type: "account_onboarding",
      });

      return res.json({ url: accountLink.url, stripe_account_id: accountId });
    } catch (err) {
      console.error("CONNECT ONBOARD error:", err);
      return res.status(500).json({ error: "Failed to create onboarding link" });
    }
  });

  return router;
};
