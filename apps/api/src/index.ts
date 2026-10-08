import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import { authRouter } from "./routes/auth"
import { applicationsRouter } from "./routes/applications"
import { dashboardRouter } from "./routes/dashboard"
import { settingsRouter } from "./routes/settings"
import { profileRouter } from "./routes/profile"
import { usersRouter } from "./routes/users"
import { workspacesRouter } from "./routes/workspaces"
import { jobsRouter } from "./routes/jobs"
import { chatRouter } from "./routes/chat"
import { eventsRouter } from "./routes/events"
import { ensureAccounts } from "./lib/accounts"
import { Profile } from "./models/Profile"

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({ origin: "*" }))
app.use(express.json({ limit: "10mb" }))

app.use("/api/auth", authRouter)
app.use("/api/applications", applicationsRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/settings", settingsRouter)
app.use("/api/profile", profileRouter)
app.use("/api/users", usersRouter)
app.use("/api/workspaces", workspacesRouter)
app.use("/api/jobs", jobsRouter)
app.use("/api/chat", chatRouter)
app.use("/api/events", eventsRouter)

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})

mongoose
  .connect(process.env.MONGODB_URI!)
  .then(async () => {
    await ensureAccounts()
    const profileIndexes = await Profile.collection.indexes()
    if (profileIndexes.some((index) => index.name === "userId_1" && index.unique)) {
      await Profile.collection.dropIndex("userId_1")
    }
    console.log("Connected to MongoDB")
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err)
    process.exit(1)
  })
