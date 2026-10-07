import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { User } from "../models/User"
import { authenticate, AuthRequest } from "../middleware/auth"
import { SIGNUP_ROLES, toPublicUser } from "../lib/roles"
import { nextUsername } from "../lib/accounts"

const router = Router()

function signToken(userId: unknown) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as string & { __brand: "ms" },
  } as jwt.SignOptions)
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

router.post("/register", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase()
    const password = String(req.body.password || "")
    const username = normalizeUsername(String(req.body.username || ""))
    const role = req.body.role

    if (!email || !password || !username) {
      return res.status(400).json({ error: "Email, username, and password are required" })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" })
    }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        error: "Username must be 3-30 characters and use letters, numbers, or underscores",
      })
    }
    if (!SIGNUP_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ error: "Choose a valid role. Leader accounts are assigned by a superadmin." })
    }

    const existingEmail = await User.findOne({ email })
    if (existingEmail) {
      return res.status(400).json({ error: "Email already in use" })
    }
    const existingUsername = await User.findOne({ username })
    if (existingUsername) {
      return res.status(400).json({ error: "Username already in use" })
    }

    const userCount = await User.countDocuments()
    const isFirstUser = userCount === 0
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await User.create({
      email,
      password: hashedPassword,
      username,
      name: username,
      role: isFirstUser ? "leader" : role,
      status: isFirstUser ? "approved" : "pending",
      isSuperAdmin: isFirstUser,
    })

    if (isFirstUser) {
      const token = signToken(user._id)
      return res.status(201).json({
        token,
        approved: true,
        user: toPublicUser(user),
        message: "You are the first account, so this login is the superadmin.",
      })
    }

    res.status(201).json({
      approved: false,
      user: toPublicUser(user),
      message: "Account submitted. A leader must approve it before you can sign in.",
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Registration failed" })
  }
})

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase()
    const password = String(req.body.password || "")

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    if (user.status === "pending") {
      return res.status(403).json({ error: "Your account is waiting for a leader to approve it" })
    }
    if (user.status === "rejected") {
      return res.status(403).json({ error: "Your account was not approved" })
    }

    if (!user.username) {
      user.username = await nextUsername(user.email.split("@")[0], user._id.toString())
      await user.save()
    }

    const token = signToken(user._id)
    res.json({
      token,
      user: toPublicUser(user),
    })
  } catch (error) {
    res.status(500).json({ error: "Login failed" })
  }
})

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    res.json({ user: toPublicUser(req.user) })
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" })
  }
})

export { router as authRouter }
