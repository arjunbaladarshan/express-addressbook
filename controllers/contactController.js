import jwt from "jsonwebtoken";
import { db } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const create = async (req, res) => {
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
    const [rows] = await db.query(
      "SELECT * FROM contacts WHERE owner_user_id = ?",
      [req.user.id]
    );
    res.status(200).json({ data: rows });
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
