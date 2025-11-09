import jwt from "jsonwebtoken";
import { db } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const createContact = async (req, res) => {
  try {
    const {
      display_name,
      given_name,
      family_name,
      company,
      job_title,
      notes,
      phones,
      emails,
    } = req.body;

    // Validation
    if (!display_name)
      return res.status(400).json({ message: "display_name fields required" });

    // Insert user
    const [dataInserted] = await db.query(
      "INSERT INTO contacts (owner_user_id, display_name, given_name,family_name,company,job_title,notes) VALUES (?, ?, ?,?,?,?,?)",
      [
        req.user.id,
        display_name,
        given_name,
        family_name,
        company,
        job_title,
        notes,
      ]
    );
    const contactId = dataInserted.insertId;
    for (const phone_data of phones) {
      // Insert phones
      await db.query(
        "INSERT INTO contact_phones (contact_id, phone_number, phone_type,is_primary) VALUES (?, ?, ?,?)",
        [
          contactId,
          phone_data.phone_number,
          phone_data.phone_type,
          phone_data.is_primary,
        ]
      );
    }

    for (const email_data of emails) {
      // Insert phones
      await db.query(
        "INSERT INTO contact_emails (contact_id, email, email_type,is_primary) VALUES (?, ?, ?,?)",
        [
          contactId,
          email_data.email,
          email_data.email_type,
          email_data.is_primary,
        ]
      );
    }

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const updateContact = async (req, res) => {
  try {
    const {
      display_name,
      given_name,
      family_name,
      company,
      job_title,
      notes,
      phones,
      emails,
    } = req.body;

    // Validation
    if (!display_name)
      return res.status(400).json({ message: "display_name fields required" });

    // Update user
    await db.query(
      "UPDATE contacts SET display_name = ?, given_name = ?, family_name = ?, company = ?, job_title = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0;",
      [
        display_name,
        given_name,
        family_name,
        company,
        job_title,
        notes,
        req.params.id,
      ]
    );
    await db.query("DELETE from contact_phones where contact_id=?", [
      req.params.id,
    ]);
    for (const phone_data of phones) {
      // Insert phones
      await db.query(
        "INSERT INTO contact_phones (contact_id, phone_number, phone_type,is_primary) VALUES (?, ?, ?,?)",
        [
          req.params.id,
          phone_data.phone_number,
          phone_data.phone_type,
          phone_data.is_primary,
        ]
      );
    }
    await db.query("DELETE from contact_emails where contact_id=?", [
      req.params.id,
    ]);
    for (const email_data of emails) {
      // Insert phones
      await db.query(
        "INSERT INTO contact_emails (contact_id, email, email_type,is_primary) VALUES (?, ?, ?,?)",
        [
          req.params.id,
          email_data.email,
          email_data.email_type,
          email_data.is_primary,
        ]
      );
    }

    res.json({ message: "User Updated successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const deleteContact = async (req, res) => {
  try {
    await db.query("DELETE from contact_phones where contact_id=?", [
      req.params.id,
    ]);
    await db.query("DELETE from contact_emails where contact_id=?", [
      req.params.id,
    ]);
    await db.query("DELETE from contacts where id=?", [req.params.id]);

    res.json({ message: "User Deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password)
      return res.status(400).json({ message: "Email and password required" });

    // Check user
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid email or password" });

    const user = rows[0];

    // Compare password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ message: "Invalid email or password" });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getAllContacts = async (req, res) => {
  try {
    let q = "";
    if (req.query.q && req.query.q !== "") {
      q = req.query.q;
    }
    console.log("q = ", q);
    let perPage = 10;
    if (req.query.perPage && req.query.perPage != "") {
      perPage = req.query.perPage;
    }

    let page = 1;
    if (req.query.page && req.query.page != 0) {
      page = req.query.page;
    }

    const offset = (page - 1) * perPage;

    const [rows] = await db.query(
      `SELECT 
    c.id,
    c.owner_user_id,
    c.display_name,
    c.given_name,
    c.family_name,
    c.company,
    c.job_title,
    c.notes,
    c.created_at,
    c.updated_at,
    c.is_deleted,
    COALESCE(e.emails, JSON_ARRAY()) AS emails,
    COALESCE(p.phones, JSON_ARRAY()) AS phones
FROM contacts AS c
LEFT JOIN (
    SELECT 
        contact_id,
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'email_id', id,
                'email', email,
                'email_type', email_type,
                'is_primary', is_primary
            )
        ) AS emails
    FROM contact_emails
    GROUP BY contact_id
) AS e ON e.contact_id = c.id
LEFT JOIN (
    SELECT 
        contact_id,
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'phone_id', id,
                'phone_number', phone_number,
                'phone_type', phone_type,
                'is_primary', is_primary
            )
        ) AS phones
    FROM contact_phones
    GROUP BY contact_id
) AS p ON p.contact_id = c.id
WHERE c.is_deleted = 0 AND c.owner_user_id=?
AND (
      c.display_name LIKE '%${q}%' OR c.given_name LIKE '%${q}%' OR c.family_name LIKE '%${q}%' OR c.company LIKE '%${q}%' OR c.job_title LIKE '%${q}%' OR c.notes LIKE '%${q}%'
      OR EXISTS (
          SELECT 1 
          FROM contact_emails ce 
          WHERE ce.contact_id = c.id 
            AND ce.email LIKE '%${q}%'
      )
      OR EXISTS (
          SELECT 1 
          FROM contact_phones cp 
          WHERE cp.contact_id = c.id 
            AND cp.phone_number LIKE '%${q}%'
      )
  )
ORDER BY c.display_name
LIMIT ${perPage} OFFSET ${offset};
`,
      [req.user.id]
    );

    const [[{ total }]] = await db.query(
      `SELECT 
      COUNT(*) as total
FROM contacts AS c
WHERE c.is_deleted = 0 AND c.owner_user_id=?
AND (
      c.display_name LIKE '%${q}%' OR c.given_name LIKE '%${q}%' OR c.family_name LIKE '%${q}%' OR c.company LIKE '%${q}%' OR c.job_title LIKE '%${q}%' OR c.notes LIKE '%${q}%'
      OR EXISTS (
          SELECT 1 
          FROM contact_emails ce 
          WHERE ce.contact_id = c.id 
            AND ce.email LIKE '%${q}%'
      )
      OR EXISTS (
          SELECT 1 
          FROM contact_phones cp 
          WHERE cp.contact_id = c.id 
            AND cp.phone_number LIKE '%${q}%'
      )
  )
ORDER BY c.display_name;
`,
      [req.user.id]
    );
    res.status(200).json({ data: rows, count: rows.length, total: total });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getContactByID = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM contacts WHERE owner_user_id = ? and id = ?",
      [req.user.id, req.params.id]
    );

    // Get all emails and phones in one go
    const [emails] = await db.query(
      `SELECT * FROM contact_emails where contact_id=${req.params.id}`
    );
    const [phones] = await db.query(
      `SELECT * FROM contact_phones where contact_id=${req.params.id}`
    );

    // Merge data
    const result = rows.map((contact) => ({
      ...rows[0],
      emails: emails,
      phones: phones,
    }));

    res.status(200).json({ data: result });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
