import express from "express";
import {
  create,
  getAllContacts,
  getContactByID,
} from "../controllers/contactController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", verifyToken, create);
router.get("/all", verifyToken, getAllContacts);
router.get("/:id", verifyToken, getContactByID);

export default router;
