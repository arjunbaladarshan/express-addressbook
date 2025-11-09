import express from "express";
import {
  createContact,
  updateContact,
  deleteContact,
  getAllContacts,
  getContactByID,
} from "../controllers/contactController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", verifyToken, createContact);
router.put("/update/:id", verifyToken, updateContact);
router.delete("/:id", verifyToken, deleteContact);
router.get("/all", verifyToken, getAllContacts);
router.get("/:id", verifyToken, getContactByID);

export default router;
