import { Router } from "express"
import { authenticate, AuthRequest } from "../middleware/auth"
import { Settings } from "../models/Settings"

const router = Router()
router.use(authenticate)

// GET /api/settings
router.get("/", async (req: AuthRequest, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.userId }).lean()

    if (!settings) {
      const created = await Settings.create({ userId: req.userId })
      settings = created.toObject() as any
    }

    res.json({ settings })
  } catch (error) {
    res.status(500).json({ error: "Failed to get settings" })
  }
})

// PUT /api/settings
router.put("/", async (req: AuthRequest, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { ...req.body, userId: req.userId },
      { new: true, upsert: true, runValidators: true }
    ).lean()

    res.json({ settings })
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" })
  }
})

export { router as settingsRouter }
