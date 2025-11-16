import express from "express";
import {
  getMembers,
  addMember,
  updateMember,
  deleteMember,
  forgotPassword,
  resetPassword,
  loginMember,
  getOwnProfile,
  updateOwnProfile
} from "../controllers/memberController";
import { getUserDashboard } from "../controllers/dashboardController";
import { authenticate, authorizeAdmin } from "../middleware/auth";

const router = express.Router();

// ===============================
// PUBLIC ROUTES (No auth required)
// ===============================
// Login (supports both memberId and sispaId)
router.post("/login", loginMember);

// Forgot password
router.post("/forgot-password", forgotPassword);

// Reset password
router.post("/reset-password/:token", resetPassword);

// ===============================
// MEMBER ROUTES (Authenticated members)
// ===============================
// Get user dashboard (home page data)
router.get("/dashboard", authenticate, getUserDashboard);

// Get own profile
router.get("/profile", authenticate, getOwnProfile);

// Update own profile (MUST be before /:id route)
router.put("/profile", authenticate, updateOwnProfile);

// ===============================
// ADMIN ROUTES (Admin only)
// ===============================
// Member CRUD - Admin only
router.get("/", authenticate, authorizeAdmin, getMembers);
router.post("/add", authenticate, authorizeAdmin, addMember);
router.put("/:id", authenticate, authorizeAdmin, updateMember);
router.delete("/:id", authenticate, authorizeAdmin, deleteMember);

export default router;
