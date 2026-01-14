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
  updateOwnProfile,
  signUp
} from "../controllers/memberController";
import { getUserDashboard } from "../controllers/dashboardController";
import { 
  getMemberUniform, 
  createMemberUniform, 
  updateMemberUniform,
  getMemberUniformBySispaId
} from "../controllers/uniformController";
import { authenticate, authorizeAdmin } from "../middleware/auth";

const router = express.Router();

// ===============================
// PUBLIC ROUTES (No auth required)
// ===============================
// Sign up / Register new account
router.post("/signup", signUp);

// Login (uses sispaId)
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

// Get own uniform collection
router.get("/uniform", authenticate, getMemberUniform);

// Create/add uniform items (adds to existing if exists)
router.post("/uniform", authenticate, createMemberUniform);

// Update/replace all uniform items
router.put("/uniform", authenticate, updateMemberUniform);

// ===============================
// ADMIN ROUTES (Admin only)
// ===============================
// Member CRUD - Admin only
router.get("/", authenticate, authorizeAdmin, getMembers);
router.post("/add", authenticate, authorizeAdmin, addMember);

// Get member uniform by sispaId (admin only) - MUST be before /:id route to avoid conflicts
router.get("/:sispaId/uniform", authenticate, authorizeAdmin, getMemberUniformBySispaId);

router.put("/:id", authenticate, authorizeAdmin, updateMember);
router.delete("/:id", authenticate, authorizeAdmin, deleteMember);

export default router;
