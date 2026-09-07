-- create DB
CREATE DATABASE IF NOT EXISTS rent_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE rent_manager;

-- USERS
CREATE TABLE users (
  user_id       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  phone         VARCHAR(30),
  role          ENUM('landlord','tenant','admin') NOT NULL DEFAULT 'tenant',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- PROPERTY (owned by a landlord user)
CREATE TABLE properties (
  property_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  owner_id      BIGINT UNSIGNED NOT NULL,
  address       VARCHAR(255) NOT NULL,
  eircode       VARCHAR(16),
  property_type ENUM('apartment','house','studio','other') NOT NULL DEFAULT 'house',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_properties_owner
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_properties_owner ON properties(owner_id);

-- TENANCY (links tenant + property, can be historical)
CREATE TABLE tenancies (
  tenancy_id     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  property_id    BIGINT UNSIGNED NOT NULL,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  rent_amount    DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  due_day        TINYINT UNSIGNED NOT NULL, -- 1..28 usually
  start_day      DATE NOT NULL,
  end_day        DATE DEFAULT NULL,
  status         ENUM('active','ended','pending') NOT NULL DEFAULT 'active',
  active         TINYINT(1) NOT NULL DEFAULT 1, -- convenience flag
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenancies_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tenancies_tenant
    FOREIGN KEY (tenant_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_due_day CHECK (due_day BETWEEN 1 AND 31)
) ENGINE=InnoDB;

-- enforce “one active tenancy per PROPERTY” and “one active tenancy per TENANT”
CREATE INDEX idx_property_active ON tenancies(property_id, active);
CREATE INDEX idx_tenant_active   ON tenancies(tenant_id, active);


-- PAYMENT (for a tenancy)
CREATE TABLE payments (
  payment_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tenancy_id   BIGINT UNSIGNED NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  method       ENUM('card','bank_transfer','cash','direct_debit','other') NOT NULL,
  status       ENUM('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'succeeded',
  receipt_url  VARCHAR(500),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_tenancy
    FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_payments_tenancy_date ON payments(tenancy_id, payment_date);

-- MAINTENANCE ticket (per tenancy)
CREATE TABLE maintenance_tickets (
  ticket_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tenancy_id  BIGINT UNSIGNED NOT NULL,
  category    VARCHAR(80) NOT NULL,  -- e.g., plumbing, electrical
  priority    ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status      ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  due_date    DATE DEFAULT NULL,
  cost        DECIMAL(10,2) DEFAULT NULL,
  receipt_url VARCHAR(500),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_tickets_tenancy
    FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_tickets_tenancy ON maintenance_tickets(tenancy_id);

-- MESSAGE (belongs to a tenancy; optionally to a ticket)
CREATE TABLE messages (
  message_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tenancy_id BIGINT UNSIGNED NOT NULL,
  ticket_id  BIGINT UNSIGNED DEFAULT NULL,
  user_id    BIGINT UNSIGNED NOT NULL, -- sender
  content    TEXT NOT NULL,
  attachment VARCHAR(500),
  sent_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_tenancy
    FOREIGN KEY (tenancy_id) REFERENCES tenancies(tenancy_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_messages_ticket
    FOREIGN KEY (ticket_id) REFERENCES maintenance_tickets(ticket_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_messages_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_messages_tenancy ON messages(tenancy_id);
CREATE INDEX idx_messages_ticket  ON messages(ticket_id);

-- COMPLIANCE items (per property)
CREATE TABLE compliance_items (
  item_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  type       ENUM('gas_cert','electric_cert','fire_alarm','ber','other') NOT NULL,
  status     ENUM('pending','submitted','approved','expired') NOT NULL DEFAULT 'pending',
  due_date   DATE DEFAULT NULL,
  attachment VARCHAR(500),
  reminder   DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_compliance_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

ALTER TABLE users
ADD COLUMN password VARCHAR(255) NOT NULL;


CREATE INDEX idx_compliance_prop_due ON compliance_items(property_id, due_date);
