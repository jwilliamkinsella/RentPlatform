require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const stripeConnectRoutes = require("./routes/stripeConnect");
const stripeRentRoutes = require("./routes/stripeRent");
const stripeWebhookRoutes = require("./routes/stripeWebhook");

const app = express();
app.use(cors());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,

  // Required for Azure MySQL 
  ssl: {
    rejectUnauthorized: true,
  },
});

console.log("Connected to DB:", process.env.DB_HOST, process.env.DB_NAME);


// Stripe webhook MUST be raw and MUST be mounted before express.json()
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }), //Stripe (2026c). Receive Stripe events in your webhook endpoint. [online] docs.stripe.com. Available at: https://docs.stripe.com/webhooks [Accessed 13 Feb. 2026]. Raw is used to avoid users being able to upload their own JSON formatted body to stripe. So Raw ensures that stripe uses the secret key to decode the information 
  stripeWebhookRoutes(pool) 
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/stripe", stripeConnectRoutes(pool));
app.use("/api/stripe", stripeRentRoutes(pool));


// Authentication middleware, adapted from middleware concept examples from W3schools, link https://www.w3schools.com/nodejs/nodejs_middleware.asp. 
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) { // bearer is the scheme used for the jwt, if it was not there react would not know what sort of token to search for. Since it is bearer react understands it is JWT 
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  // Verify using jwt to ensure it is the correct token, adapted from geeks for geeks to include the user who is interacting role and ID, https://www.geeksforgeeks.org/node-js/how-to-create-and-verify-jwts-with-node-js/.
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };
    next();
  } catch (err) {     //  handle invalid or expired tokens to show the error on the backend 
    console.error("JWT verify error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Theory of RBAC taken from expressjs.com and applied to users using my system, landlords and tenants. https://expressjs.com/en/guide/using-middleware.html 
function requireLandlord(req, res, next) {
  if (!req.user || req.user.role !== "landlord") {
    return res.status(403).json({ message: "Landlord access only" });
  }
  next();
}

function requireTenant(req, res, next) {
  if (!req.user || req.user.role !== "tenant") {
    return res.status(403).json({ message: "Tenant access only" });
  }
  next();
}

// Random numbers adapted and found on geeks for geeks, https://www.geeksforgeeks.org/javascript/generate-random-characters-numbers-in-javascript/. Shows creating a string of the characters it can use then for for each letter use a random character from that list 
function generateJoinCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}


//Due date logic https://chatgpt.com/share/69852369-4c00-8003-8a1b-481ee9b418d7 - Logic designed to set the correct due date, ChatGPT assisted with the creation of the functions carry out due date setting 
function isWeekend(d) {
  const day = d.getDay(); 
  return day === 0 || day === 6;
}

function firstWorkingDay(year, monthIndex0) {
  const d = new Date(year, monthIndex0, 1);
  while (isWeekend(d)) d.setDate(d.getDate() + 1); //(W3Schools, 2025a) Getday used to get the date, (W3Schools, 2025b) setDate will then set the date to whatever the date is at and +1 to get it to the next working day
  return d;
}

function lastWorkingDay(year, monthIndex0) {
  const d = new Date(year, monthIndex0 + 1, 0);
  while (isWeekend(d)) d.setDate(d.getDate() - 1); // same approach made, if its the weekend, it will set the date, then -1 to take it out of the weekend and be the final working day of the year.
  return d;
}

function computeDueDateForMonth(year, monthIndex0, dueDay) { // this function is a safeguard put in place to stop users from entering numbers that do not match the rule. Eg if i enter 17 it won't accept ass it is not striclty 1 or 31
  if (dueDay === 1) return firstWorkingDay(year, monthIndex0);
  if (dueDay === 31) return lastWorkingDay(year, monthIndex0);
  throw new Error("Invalid due_day rule");
}

function monthKey(d) { // function created to convert the date into month numbers by multiplying the year by months and add the month then. It is used below to get each due date for rent which will be used in iteration 5
  return d.getFullYear() * 12 + d.getMonth();
}





// Ping DB on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    console.log("DB connection OK");
    connection.release();
  } catch (error) {
    console.error("DB connection failed:", error.message);
  }
})();

// SIMPLE HEALTH CHECK ROUTE
app.get("/", (request, response) => {
  response.send("API is running");
});


// REGISTER
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ message: "All fields required" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashed, role]
    );
    res.json({ message: "User registered", id: result.insertId });
  } catch (err) {
    console.error("REGISTER error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
/*The register Request goes will ensure that if any of the information (name, email, password and role) are blank they will show the message, otherwise it will insert the information inputted into the table,  if there is an error with saving or accessing the user table it will show the 500 internal system error*/ 


// LOGIN
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid email or password" });

/* The Login request will go through the information in the users table and compare what the user inputs and compare it against what emails they have got.  */

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid email or password" });

    /* This will compare the password they have entered to the password that is onfile and encrypted in the user table. If it does not match it will pass the message */
    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
/* when logging in it will assign a token to the user using their ID and Role and provide a secure login, it will authenticate the user and allow them to not have to login each time they open the website for 24 hours. */


    res.json({
      message: "Login successful",
      token,
      user: { id: user.user_id, name: user.name, role: user.role },
    });
    // success message when they access the correct user ID, name and role
  } catch (err) {
    console.error("LOGIN error:", err.message);
    res.status(500).json({ error: err.message });
  }
});



//Create Property -- pulls in the requirelandlord from the middleware ensring only landlords can do this action and authmiddleware to get the token to do this action
app.post("/api/properties", authMiddleware, requireLandlord, async (req, res) => {
  const ownerId = req.user.id;
  const { address, eircode, property_type = "house" } = req.body;

  if (!address) {
    return res.status(400).json({ message: "Address is required" });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO properties (owner_id, address, eircode, property_type)
       VALUES (?, ?, ?, ?)`,
      [ownerId, address, eircode || null, property_type]
    );

    res.status(201).json({
      message: "Property created",
      property_id: result.insertId,
    });
  } catch (err) {
    console.error("CREATE PROPERTY error:", err.message);
    res.status(500).json({ error: "Error creating property" });
  }
});

// Get property, same again pulls from authmiddleware for the bearer token, then landlord just ensuring only landlords can do this action 
app.get(
  "/api/properties",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;

    try {
      const [rows] = await pool.execute(
        "SELECT property_id, address FROM properties WHERE owner_id = ? ORDER BY property_id DESC",
        [ownerId]
      );

      res.json(rows);
    } catch (err) {
      console.error("GET PROPERTIES error:", err.message);
      res.status(500).json({ error: "Error loading properties" });
    }
  }
);

//If there is an error accessing the backend it will present the 500 error 

// DELETE PROPERTY — only landlords can delete their own properties    
app.delete(
  "/api/properties/:id",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;          // landlord’s ID from JWT
    const propertyId = req.params.id;     // property ID from the URL

    try {
      // Ensure the property belongs to this landlord
      const [rows] = await pool.execute(
        "SELECT * FROM properties WHERE property_id = ? AND owner_id = ?",
        [propertyId, ownerId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Property not found or not owned by you" });
      }

      // Delete the property
      await pool.execute("DELETE FROM properties WHERE property_id = ?", [propertyId]); //https://www.w3schools.com/nodejs/nodejs_mysql_delete.asp adapted from w3schools added await pool.execute so it will wait for the delete action to occur before continuing the execution 

      res.status(200).json({ message: "Property deleted successfully" });
    } catch (err) {
      console.error("DELETE PROPERTY error:", err.message);
      res.status(500).json({ error: "Error deleting property" });
    }
  }
);


// Create tenancy, bearer and role taken from functions above. it will take the users authenticated ID, the property ID from the URL, and then also the inputted information from the front, set up currently for back end testing not front end. https://chatgpt.com/share/69209bde-9dd8-8003-b105-237d3821603b chat was adapted and used to help structure my code on what was necessary for this route, not used in front end, just for backend testing 
app.post(
  "/api/properties/:propertyId/tenancies",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;
    const { propertyId } = req.params;
    const {
      rent_amount,
      deposit_amount = 0,
      due_day,
      start_day,
      end_day = null,
      number_of_tenants = 1,
    } = req.body;

    if (rent_amount == null || due_day == null || !start_day || !end_day) {
      return res.status(400).json({ message: "rent_amount, due_day, start_day and end_day are required" });
    }

    try {
      // Check property belongs to this landlord, ensures 
      const [props] = await pool.execute(
        "SELECT * FROM properties WHERE property_id = ?",
        [propertyId]
      );

      if (props.length === 0) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (props[0].owner_id !== ownerId) {
        return res.status(403).json({ message: "Not your property" });
      }

      const dueRule = Number(due_day);
      if (![1, 31].includes(dueRule)) {
        return res.status(400).json({ message: "due_day must be 1 or 31" });
      }
      if (new Date(end_day) < new Date(start_day)) {
        return res.status(400).json({ message: "end_day cannot be before start_day" });
      }


      // Insert tenancy
      const [tenancyResult] = await pool.execute(
        `INSERT INTO tenancies
         (property_id, rent_amount, deposit_amount, due_day, start_day, end_day, status, active)
         VALUES (?, ?, ?, ?, ?, ?, 'active', 1)`,
        [propertyId, rent_amount, deposit_amount, dueRule, start_day, end_day]
      );
      const tenancyId = tenancyResult.insertId;

      // Create invite codes in tenancy_tenants
      const count = Math.max(1, Math.min(Number(number_of_tenants) || 1, 10));
      const inviteCodes = [];

      for (let i = 0; i < count; i++) {
        const code = generateJoinCode();
        await pool.execute(
          `INSERT INTO tenancy_tenants (tenancy_id, tenant_id, join_code)
           VALUES (?, NULL, ?)`,
          [tenancyId, code]
        );
        inviteCodes.push(code); // method to generate the code came from yt video, from iteration 1
      }

      res.status(201).json({
        message: "Tenancy created",
        tenancy_id: tenancyId,
        invite_codes: inviteCodes,
      });
    } catch (err) {
      console.error("CREATE TENANCY error:", err.message);
      res.status(500).json({ error: "Error creating tenancy" });
    }
  }
);

// Tenant joins via entering the generated code from the landlord, https://stackoverflow.com/questions/1492710/how-to-implement-an-invitation-code-to-share-resource-with-another-user && https://chatgpt.com/share/6973e5c1-be78-8003-bc57-11efb1542570
app.post(
  "/api/tenancies/join",
  authMiddleware,
  requireTenant,
  async (req, res) => {
    const tenantId = req.user.id;
    const { join_code } = req.body;

    if (!join_code) {
      return res.status(400).json({ message: "join_code is required" });
    }

    try {
      const [rows] = await pool.execute(
        "SELECT * FROM tenancy_tenants WHERE join_code = ?",
        [join_code]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Invalid code" });
      }

      const invite = rows[0];

      // already claimed by someone else
      if (invite.tenant_id && invite.tenant_id !== tenantId) {
        return res
          .status(400)
          .json({ message: "This code has already been used" });
      }

      await pool.execute(
        `UPDATE tenancy_tenants
         SET tenant_id = ?, claimed_at = NOW()
         WHERE id = ?`,
        [tenantId, invite.id]
      );

      res.json({
        message: "Tenancy joined successfully",
        tenancy_id: invite.tenancy_id,
      });
    } catch (err) {
      console.error("JOIN TENANCY error:", err.message);
      res.status(500).json({ error: "Error joining tenancy" });
    }
  }
);

// POST - Tenant creates a maintenance ticket
app.post(
  "/api/me/maintenance",
  authMiddleware,
  requireTenant,
  async (req, res) => {
    const tenantId = req.user.id;
    const { category, description } = req.body;

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Description is required" });
    }

    try {
      // Get the tenant's tenancy_id
      const [tenancyRows] = await pool.execute(
        `SELECT t.tenancy_id
         FROM tenancy_tenants tt
         JOIN tenancies t ON tt.tenancy_id = t.tenancy_id
         WHERE tt.tenant_id = ?
         ORDER BY t.created_at DESC
         LIMIT 1`,
        [tenantId]
      );

      if (tenancyRows.length === 0) {
        return res.status(400).json({ message: "You must be in a tenancy to log maintenance." });
      }

      const tenancyId = tenancyRows[0].tenancy_id;

      const [result] = await pool.execute(
        `INSERT INTO maintenance_tickets (tenancy_id, category, description, status)
         VALUES (?, ?, ?, 'open')`,
        [tenancyId, category, description.trim()]
      );

      res.status(201).json({
        message: "Maintenance request submitted",
        ticket_id: result.insertId,
      });
    } catch (err) {
      console.error("CREATE MAINTENANCE TICKET error:", err.message);
      res.status(500).json({ error: "Error creating maintenance ticket" });
    }
  }
);


// GET - Tenant views their own maintenance tickets
// Ai assistance, see claude fyp iteration document references
app.get(
  "/api/me/maintenance",
  authMiddleware,
  requireTenant,
  async (req, res) => {
    const tenantId = req.user.id;

    try {
      const [rows] = await pool.execute(
        `SELECT 
           mt.ticket_id,
           mt.category,
           mt.description,
           mt.status,
           mt.created_at,
           mt.resolved_at
         FROM maintenance_tickets mt
         JOIN tenancies t ON mt.tenancy_id = t.tenancy_id
         JOIN tenancy_tenants tt ON tt.tenancy_id = t.tenancy_id
         WHERE tt.tenant_id = ?
         ORDER BY mt.created_at DESC`,
        [tenantId]
      );

      res.json(rows);
    } catch (err) {
      console.error("GET MAINTENANCE TICKETS error:", err.message);
      res.status(500).json({ error: "Error loading maintenance tickets" });
    }
  }
);

// GET - Landlord views maintenance tickets for a property
app.get(
  "/api/properties/:propertyId/maintenance",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;
    const { propertyId } = req.params;

    try {
      // Verify property belongs to this landlord
      const [props] = await pool.execute(
        "SELECT * FROM properties WHERE property_id = ? AND owner_id = ?",
        [propertyId, ownerId]
      );

      if (props.length === 0) {
        return res.status(404).json({ message: "Property not found or not owned by you" });
      }

      // Get all maintenance tickets for tenancies linked to this property
      const [tickets] = await pool.execute(
        `SELECT 
           mt.ticket_id,
           mt.tenancy_id,
           mt.category,
           mt.description,
           mt.priority,
           mt.status,
           mt.due_date,
           mt.cost,
           mt.created_at,
           mt.resolved_at,
           u.name AS tenant_name,
           u.email AS tenant_email,
           tt.room_label
         FROM maintenance_tickets mt
         JOIN tenancies t ON mt.tenancy_id = t.tenancy_id
         JOIN tenancy_tenants tt ON tt.tenancy_id = t.tenancy_id AND tt.tenant_id IS NOT NULL
         JOIN users u ON tt.tenant_id = u.user_id
         WHERE t.property_id = ?
         ORDER BY 
           CASE mt.status 
             WHEN 'open' THEN 1 
             WHEN 'in_progress' THEN 2 
             WHEN 'resolved' THEN 3 
             WHEN 'closed' THEN 4 
             ELSE 5 
           END,
           mt.created_at DESC`,
        [propertyId]
      );

      res.json(tickets);
    } catch (err) {
      console.error("GET PROPERTY MAINTENANCE error:", err.message);
      res.status(500).json({ error: "Error loading maintenance tickets" });
    }
  }
);


// PUT - Landlord updates a maintenance ticket (status, priority, cost, due_date)
// Ai assistance, see claude fyp iteration document references
app.put(
  "/api/maintenance/:ticketId",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;
    const { ticketId } = req.params;
    const { status, priority, cost, due_date } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be: " + validStatuses.join(", ") });
    }

    try {
      // Verify this ticket belongs to a property owned by this landlord
      const [rows] = await pool.execute(
        `SELECT mt.ticket_id
         FROM maintenance_tickets mt
         JOIN tenancies t ON mt.tenancy_id = t.tenancy_id
         JOIN properties p ON t.property_id = p.property_id
         WHERE mt.ticket_id = ? AND p.owner_id = ?`,
        [ticketId, ownerId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Ticket not found or not owned by you" });
      }

      // Set resolved_at when status changes to resolved
      const resolvedAt = status === "resolved" ? new Date() : null;

      const [result] = await pool.execute(
        `UPDATE maintenance_tickets 
         SET status = ?, 
             priority = ?, 
             cost = ?, 
             due_date = ?,
             resolved_at = COALESCE(?, resolved_at)
         WHERE ticket_id = ?`,
        [status, priority || null, cost ?? null, due_date || null, resolvedAt, ticketId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json({ message: "Ticket updated successfully" });
    } catch (err) {
      console.error("UPDATE MAINTENANCE TICKET error:", err.message);
      res.status(500).json({ error: "Error updating maintenance ticket" });
    }
  }
);


// Get tenants tenancy for test in postman to show connection after entering code
app.get(
  "/api/me/tenancy",
  authMiddleware,
  requireTenant,
  async (req, res) => {
    const tenantId = req.user.id;

    try {
      const [rows] = await pool.execute(// adaption made here to take the rent share amount from tenancy tenants table to include in the API call for the tenant dashboard to show the rent due 
        `SELECT 
          tt.id AS tenancy_tenant_id,
          t.tenancy_id,
          t.rent_amount,
          tt.rent_share_amount AS rent_share_amount, 
          tt.room_label AS room_label,
          t.deposit_amount,
          t.due_day,
          t.start_day,
          t.end_day,
          t.status,
          p.property_id,
          p.address,
          p.eircode,
          p.property_type
        FROM tenancy_tenants tt
        JOIN tenancies t ON tt.tenancy_id = t.tenancy_id
        JOIN properties p ON t.property_id = p.property_id
        WHERE tt.tenant_id = ?
        ORDER BY t.created_at DESC
        LIMIT 1`,
        [tenantId]
      );

      

      if (rows.length === 0) {
        return res.json(null); 
      }

      res.json(rows[0]);
    } catch (err) {
      console.error("GET ME TENANCY error:", err.message);
      res.status(500).json({ error: "Error loading tenancy" });
    }
  }
);

// GET payments for a property - landlord
// Ai assistance, see claude fyp iteration document references
app.get(
  "/api/properties/:propertyId/payments",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;
    const { propertyId } = req.params;

    try {
      // Verify property belongs to this landlord
      const [props] = await pool.execute(
        "SELECT * FROM properties WHERE property_id = ? AND owner_id = ?",
        [propertyId, ownerId]
      );

      if (props.length === 0) {
        return res.status(404).json({ message: "Property not found or not owned by you" });
      }

      // Get all payments for tenants in this property's tenancies
      const [payments] = await pool.execute(
        `SELECT 
           pay.payment_id,
           pay.payment_date,
           pay.amount,
           pay.status,
           pay.method,
           pay.receipt_url,
           pay.currency,
           u.name AS tenant_name,
           u.email AS tenant_email,
           tt.room_label
         FROM payments pay
         JOIN tenancy_tenants tt ON pay.tenancy_tenant_id = tt.id
         JOIN tenancies t ON tt.tenancy_id = t.tenancy_id
         JOIN users u ON pay.tenant_id = u.user_id
         WHERE t.property_id = ?
         ORDER BY pay.payment_date DESC`,
        [propertyId]
      );

      res.json(payments);
    } catch (err) {
      console.error("GET PROPERTY PAYMENTS error:", err.message);
      res.status(500).json({ error: "Error loading payments" });
    }
  }
);

// Get tenant's payment history
app.get(
  "/api/me/payments",
  authMiddleware,
  requireTenant,
  async (req, res) => {
    const tenantId = req.user.id;

    try {
      const [rows] = await pool.execute(
        `SELECT 
          p.payment_id,
          p.amount,
          p.payment_date,
          p.method,
          p.status,
          p.receipt_url,
          p.currency,
          p.created_at
        FROM payments p
        WHERE p.tenant_id = ?
        ORDER BY p.payment_date DESC`,
        [tenantId]
      );

      res.json(rows);
    } catch (err) {
      console.error("GET ME PAYMENTS error:", err.message);
      res.status(500).json({ error: "Error loading payment history" });
    }
  }
);

// Update room_label + rent_share_amount for tenancy slots // https://chatgpt.com/share/6986685c-f8f4-8003-a202-14b09a20af77 chatgpt aided in the creation of the API for tenancyIDsplits which allows the landlord to select his property and on the SplitRent screen see the loaded tenant codes, and he can enter the nickname for room and then enter the price he wants for that room and submit to save the multiple records if he has more than 1 tenant.  
app.put(
  "/api/tenancies/:tenancyId/splits",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;
    const { tenancyId } = req.params;
    const { splits } = req.body;

    if (!Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ message: "splits array is required" });
    }

    // Ensure landlord owns this tenancy and get rent_amount
    const [tenRows] = await pool.execute(
      `SELECT t.tenancy_id, t.rent_amount
       FROM tenancies t
       JOIN properties p ON t.property_id = p.property_id
       WHERE t.tenancy_id = ? AND p.owner_id = ?
       LIMIT 1`,
      [tenancyId, ownerId]
    );

    if (tenRows.length === 0) {
      return res.status(404).json({ message: "Tenancy not found" });
    }

    const rentAmount = Number(tenRows[0].rent_amount);

    // Validate all amounts and calculate total
    let totalShares = 0;
    for (const s of splits) {
      const id = Number(s.id);
      const amt = Number(s.rent_share_amount);

      if (!id || !Number.isFinite(amt) || amt < 0) {
        return res.status(400).json({ message: "Invalid split payload — all amounts must be valid numbers >= 0" });
      }

      totalShares += amt;
    }

    // Round to 2 decimal places to avoid floating point issues
    totalShares = Math.round(totalShares * 100) / 100;

    // Validate total equals rent amount
    if (Math.abs(totalShares - rentAmount) > 0.01) {
      return res.status(400).json({
        message: `Total rent shares (€${totalShares.toFixed(2)}) must equal the total rent amount (€${rentAmount.toFixed(2)}).`,
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const s of splits) {
        const id = Number(s.id);
        const amt = Number(s.rent_share_amount);

        // Update ONLY rows that belong to this tenancy
        const [result] = await conn.execute(
          `UPDATE tenancy_tenants
           SET rent_share_amount = ?, room_label = ?
           WHERE id = ? AND tenancy_id = ?`,
          [amt, s.room_label || null, id, tenancyId]
        );

        if (result.affectedRows === 0) {
          throw new Error(`Row id ${id} not found in this tenancy`);
        }
      }

      await conn.commit();
      res.json({ message: "Splits saved" });
    } catch (err) {
      await conn.rollback();
      console.error("SAVE SPLITS error:", err.message);
      res.status(400).json({ message: err.message || "Error saving splits" });
    } finally {
      conn.release();
    }
  }
);

/*
//Due date Schedule routes
app.get(
  "/api/me/due-schedule",
  authMiddleware,
  requireTenant,
  async (req, res) => {
    const tenantId = req.user.id;

    try {
      const [rows] = await pool.execute(
        `SELECT t.tenancy_id, t.due_day, t.start_day, t.end_day
         FROM tenancy_tenants tt
         JOIN tenancies t ON tt.tenancy_id = t.tenancy_id
         WHERE tt.tenant_id = ?
         ORDER BY t.created_at DESC
         LIMIT 1`,
        [tenantId]
      );

      if (rows.length === 0) return res.json([]);

      const tenancy = rows[0];
      const dueRule = Number(tenancy.due_day);

      if (![1, 31].includes(dueRule)) {
        return res.status(400).json({ message: "due_day must be 1 or 31" });
      }
      if (!tenancy.start_day || !tenancy.end_day) {
        return res.status(400).json({ message: "start_day and end_day are required" });
      }

      const start = new Date(tenancy.start_day);
      const end = new Date(tenancy.end_day);

      if (end < start) {
        return res.status(400).json({ message: "end_day cannot be before start_day" });
      }

      const startMonth = monthKey(start);
      const endMonth = monthKey(end);

      const schedule = [];

      for (let mk = startMonth; mk <= endMonth; mk++) {
        const year = Math.floor(mk / 12);
        const monthIndex0 = mk % 12;

        const due = computeDueDateForMonth(year, monthIndex0, dueRule);

        // Optional filters so you don't show a due date before tenancy begins or after it ends
        if (due < start) continue;
        if (due > end) continue;

        schedule.push({
          due_date: due.toISOString().slice(0, 10),
          year,
          month: monthIndex0 + 1,
        });
      }

      res.json({
        tenancy_id: tenancy.tenancy_id,
        due_rule: dueRule === 1 ? "FIRST_WORKING_DAY" : "LAST_WORKING_DAY",
        schedule,
      });
    } catch (err) {
      console.error("DUE SCHEDULE error:", err.message);
      res.status(500).json({ error: "Error building due schedule" });
    }
  }
);*/

// Get tenancy by tenancyId (for SplitRent screen) Structure taken from previous Api calls 
app.get(
  "/api/tenancies/:tenancyId",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const ownerId = req.user.id;
    const { tenancyId } = req.params;

    try {
      // Get tenancy + confirm it belongs to this landlord if not it will show the error message that there is no tenancy found
      const [rows] = await pool.execute(
        `SELECT t.*, p.address
         FROM tenancies t
         JOIN properties p ON t.property_id = p.property_id
         WHERE t.tenancy_id = ? AND p.owner_id = ?
         LIMIT 1`,
        [tenancyId, ownerId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Tenancy not found" });
      }

      const tenancy = rows[0];

      //Get codes + rent_share_amount + room_label + tenant details if it is found it will save the invite codes under the variable codes and then have it fetches back the data for the number of codes inside of variable codes
      const [codes] = await pool.execute(
        `SELECT
           tt.id,
           tt.join_code,
           tt.tenant_id,
           tt.claimed_at,
           tt.rent_share_amount,
           tt.room_label,
           u.name AS tenant_name,
           u.email AS tenant_email
         FROM tenancy_tenants tt
         LEFT JOIN users u ON tt.tenant_id = u.user_id
         WHERE tt.tenancy_id = ?
         ORDER BY tt.id ASC`,
        [tenancyId]
      );

      tenancy.invite_codes = codes;

      res.json(tenancy);
    } catch (err) {
      console.error("GET TENANCY BY ID error:", err.message);
      res.status(500).json({ message: "Error loading tenancy" });
    }
  }
);


// Get a single property
app.get("/api/properties/:id", authMiddleware, requireLandlord, async (req, res) => {
  const ownerId = req.user.id;
  const propertyId = req.params.id;

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM properties WHERE property_id = ? AND owner_id = ?",
      [propertyId, ownerId]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Property not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("GET PROPERTY error:", err.message);
    res.status(500).json({ error: "Error retrieving property" });
  }
});

// Update a property
app.put("/api/properties/:id", authMiddleware, requireLandlord, async (req, res) => {
  const ownerId = req.user.id;
  const propertyId = req.params.id;
  const { address, eircode, property_type } = req.body;

  try {
    const [result] = await pool.execute(
      "UPDATE properties SET address = ?, eircode = ?, property_type = ? WHERE property_id = ? AND owner_id = ?",
      [address, eircode, property_type, propertyId, ownerId]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Property not found or not owned by you" });

    res.json({ message: "Property updated successfully" });
  } catch (err) {
    console.error("UPDATE PROPERTY error:", err.message);
    res.status(500).json({ error: "Error updating property" });
  }
});

// Get tenancy for a specific property
app.get("/api/properties/:id/tenancy", authMiddleware, requireLandlord, async (req, res) => {
  const ownerId = req.user.id;
  const propertyId = req.params.id;

  try {
    const [rows] = await pool.execute(
      `SELECT t.*, p.address 
       FROM tenancies t
       JOIN properties p ON t.property_id = p.property_id
       WHERE p.owner_id = ? AND p.property_id = ?
       ORDER BY t.tenancy_id DESC LIMIT 1`,
      [ownerId, propertyId]
    );

    if (rows.length === 0) return res.json(null);

    const tenancy = rows[0];

    //Get full invite code info (join_code, tenant_id, claimed_at, and tenant name/email) this is for the landlord view tenant screen where it has the tenant code which is tt and user info for u
    const [codes] = await pool.execute(
      `SELECT 
         tt.join_code,
         tt.tenant_id,
         tt.claimed_at,
         u.name AS tenant_name,
         u.email AS tenant_email
       FROM tenancy_tenants tt
       LEFT JOIN users u ON tt.tenant_id = u.user_id
       WHERE tt.tenancy_id = ?`,
      [tenancy.tenancy_id]
    );

    tenancy.invite_codes = codes; // include all details

    res.json(tenancy);
  } catch (err) {
    console.error("GET TENANCY error:", err.message);
    res.status(500).json({ error: "Error loading tenancy details" });
  }
});


// Update tenancy details 
app.put(
  "/api/tenancies/:tenancyId",
  authMiddleware,
  requireLandlord,
  async (req, res) => {
    const { tenancyId } = req.params;
    const { due_day, start_day, end_day } = req.body;

    if (due_day == null || !start_day || !end_day) {
      return res.status(400).json({ message: "due_day, start_day and end_day are required" });
    }

    const dueRule = Number(due_day); //due rule take the due_day and saves it as a variable input for "1" becomes 1 and "31" becomes 31 to ensure that if a bad actor tries to enter a date to pay his/hers rent on a day that is not the first or last working day the rule will stop it from submitting and give the error message that it must be one of the options.
    if (![1, 31].includes(dueRule)) {
      return res.status(400).json({ message: "due_day must be 1 or 31" });
    }

    if (new Date(end_day) < new Date(start_day)) {
      return res.status(400).json({ message: "end_day cannot be before start_day" });
    }// logic to ensure that date for end date cannot be set to be before the start date

    try {
      const [result] = await pool.execute(
        `UPDATE tenancies 
         SET due_day = ?, start_day = ?, end_day = ?
         WHERE tenancy_id = ?`,
        [dueRule, start_day, end_day, tenancyId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Tenancy not found" });
      }

      res.json({ message: "Tenancy updated successfully" });
    } catch (err) {
      console.error("UPDATE TENANCY error:", err.message);
      res.status(500).json({ error: "Error updating tenancy" });
    }
  }
);

app.listen(process.env.PORT || 3001, () => {
  console.log(
    `Server running on http://localhost:${process.env.PORT || 3001}`
  );
});
//CRUD Ability for user table
/*// READ ALL USERS
app.get("/users", async (request, response) => {
  try {
    const [users] = await pool.query(
      "SELECT * FROM users ORDER BY user_id DESC"
    );
    return response.json(users);
  } catch (error) {
    console.error("GET /users error:", error.message);
    return response
      .status(500)
      .json({ error: "Internal server error" });
  }
});

// READ ONE USER
app.get("/users/:id", async (request, response) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE user_id = ?",
      [request.params.id]
    );

    if (!rows.length) {
      return response
        .status(404)
        .json({ error: "User not found" });
    }

    return response.json(rows[0]);
  } catch (error) {
    console.error("GET /users/:id error:", error.message);
    return response
      .status(500)
      .json({ error: "Internal server error" });
  }
});

// CREATE USER
app.post("/users", async (request, response) => {
  try {
    // Make sure the client sent JSON 
    if (!request.is("application/json")) {
      return response
        .status(415)
        .json({ error: "Content-Type must be json" });
    }

    const { name, email, phone, role } = request.body || {};

    // Basic validation
    if (!name || !email) {
      return response
        .status(400)
        .json({ error: "name and email are required" });
    }

    const finalRole = role || "tenant";

    const [result] = await pool.execute(
      "INSERT INTO users (name, email, phone, role) VALUES (?, ?, ?, ?)",
      [name, email, phone || null, finalRole]
    );

    return response.status(201).json({ id: result.insertId });
  } catch (error) {
    // Prevent duplicate emails
    if (error && error.code === "ER_DUP_ENTRY") {
      return response
        .status(409)
        .json({ error: "Email already exists" });
    }

    console.error("POST /users error:", error.message);
    return response
      .status(500)
      .json({ error: "Internal server error" });
  }
});

// UPDATE USER (full replace with PUT)
app.put("/users/:id", async (request, response) => {
  try {
    if (!request.is("application/json")) {
      return response
        .status(415)
        .json({ error: "Content-Type must be application/json" });
    }

    const { name, email, phone, role } = request.body || {};

    // PUT = full update, so we expect required fields
    if (!name || !email) {
      return response
        .status(400)
        .json({ error: "name and email are required for PUT" });
    }

    const [result] = await pool.execute(
      "UPDATE users SET name=?, email=?, phone=?, role=? WHERE user_id=?",
      [name, email, phone || null, role || "tenant", request.params.id]
    );

    if (result.affectedRows === 0) {
      return response
        .status(404)
        .json({ error: "User not found" });
    }

    return response.json({ updated: result.affectedRows });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return response
        .status(409)
        .json({ error: "Email already exists" });
    }

    console.error("PUT /users/:id error:", error.message);
    return response
      .status(500)
      .json({ error: "Internal server error" });
  }
});

// PARTIAL UPDATE USER (PATCH)
app.patch("/users/:id", async (request, response) => {
  try {
    if (!request.is("application/json")) {
      return response
        .status(415)
        .json({ error: "Content-Type must be application/json" });
    }

    const { name, email, phone, role } = request.body || {};

    // For PATCH, at least one field must be provided
    if (
      name === undefined &&
      email === undefined &&
      phone === undefined &&
      role === undefined
    ) {
      return response
        .status(400)
        .json({ error: "Provide at least one field to update" });
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         role = COALESCE(?, role)
       WHERE user_id = ?`,
      [
        name ?? null,
        email ?? null,
        phone ?? null,
        role ?? null,
        request.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return response
        .status(404)
        .json({ error: "User not found" });
    }

    return response.json({ updated: result.affectedRows });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return response
        .status(409)
        .json({ error: "Email already exists" });
    }

    console.error("PATCH /users/:id error:", error.message);
    return response
      .status(500)
      .json({ error: "Internal server error" });
  }
});

// DELETE USER
app.delete("/users/:id", async (request, response) => {
  try {
    const [result] = await pool.execute(
      "DELETE FROM users WHERE user_id=?",
      [request.params.id]
    );

    if (result.affectedRows === 0) {
      return response
        .status(404)
        .json({ error: "User not found" });
    }

    return response.json({ deleted: result.affectedRows });
  } catch (error) {
    console.error("DELETE /users/:id error:", error.message);
    return response
      .status(500)
      .json({ error: "Internal server error" });
  }
});*/


