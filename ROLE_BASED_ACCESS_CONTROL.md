# Role-Based Access Control Implementation

This document describes the role-based access control (RBAC) implementation for the Smart Uniform Backend.

## Overview

The system now supports two user roles:
- **Admin**: Full access to all pages (batch, member, inventory/uniform, forecasting)
- **Member**: Can only view/update their own uniform and profile information

## Authentication

### JWT Token Authentication
- All protected routes require a JWT token in the Authorization header: `Bearer <token>`
- Tokens expire after 7 days
- JWT_SECRET should be set in `.env` file

### Login Endpoints

**POST `/api/members/login`**
- Supports both `memberId` and `sispaId` login
- Request body:
  ```json
  {
    "memberId": "string" (optional),
    "sispaId": "string" (optional),
    "password": "string"
  }
  ```
- Response includes JWT token and user information:
  ```json
  {
    "success": true,
    "token": "jwt_token_here",
    "member": {
      "memberId": "string",
      "name": "string",
      "email": "string",
      "role": "admin" | "member",
      "sispaId": "string"
    }
  }
  ```

## Admin Routes

All admin routes require:
1. Authentication (`authenticate` middleware)
2. Admin role (`authorizeAdmin` middleware)

### Batch Management
- `GET /api/batches` - Get all batches
- `POST /api/batches` - Add new batch
- `PUT /api/batches/:id` - Update batch
- `DELETE /api/batches/:id` - Delete batch

### Member Management
- `GET /api/members` - Get all members
- `POST /api/members/add` - Add new member
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member

### Inventory/Uniform Management
- `GET /api/uniforms` - Get all uniforms (inventory)
- `POST /api/uniforms` - Add uniform to inventory
- `PUT /api/uniforms/:id` - Update uniform in inventory
- `DELETE /api/uniforms/:id` - Delete uniform from inventory

## Member Routes

All member routes require authentication (`authenticate` middleware) but are accessible to both admin and member roles.

### Profile Management
- `GET /api/members/profile` - Get own profile
- `PUT /api/members/profile` - Update own profile

### Uniform Management
- `GET /api/uniforms/my-uniform` - Get own uniform
- `POST /api/uniforms/my-uniform` - Add own uniform (first time login)
- `PUT /api/uniforms/my-uniform` - Update own uniform

## Public Routes

These routes don't require authentication:
- `POST /api/members/login` - Login
- `POST /api/members/forgot-password` - Request password reset
- `POST /api/members/reset-password/:token` - Reset password

## Database Schema Changes

### Member Model
Added fields:
- `role`: `'admin' | 'member'` (default: 'member')
- `sispaId`: `string` (optional, unique, sparse index)

### Uniform Model
Added field:
- `memberId`: `string` (optional, links uniform to member for personal uniforms)

## Environment Variables

Add to your `.env` file:
```
JWT_SECRET=your-secret-key-here
```

## Usage Examples

### Admin Login
```bash
POST /api/members/login
{
  "memberId": "admin001",
  "password": "password123"
}
```

### Member Login (with SISPA ID)
```bash
POST /api/members/login
{
  "sispaId": "SISPA123456",
  "password": "password123"
}
```

### Accessing Protected Routes
Include the JWT token in the Authorization header:
```bash
GET /api/batches
Authorization: Bearer <your_jwt_token>
```

### Member Adding Their Uniform (First Time)
```bash
POST /api/uniforms/my-uniform
Authorization: Bearer <member_jwt_token>
{
  "category": "Shirt",
  "type": "Polo",
  "size": "M",
  "quantity": 1,
  "status": "in-stock"
}
```

## Security Notes

1. Passwords are automatically hashed using bcrypt when creating/updating members
2. Passwords are never returned in API responses
3. JWT tokens should be stored securely on the frontend (e.g., in httpOnly cookies or secure storage)
4. Admin routes are protected by both authentication and authorization middleware
5. Members can only access their own data (enforced by memberId in JWT token)

