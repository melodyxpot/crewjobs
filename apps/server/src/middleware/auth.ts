import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { User, IUser } from "../models/User"

export interface AuthRequest extends Request {
  userId?: string
  user?: IUser
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" })
  }

  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    const user = await User.findById(decoded.userId).select("-password")
    if (!user) {
      return res.status(401).json({ error: "Invalid token" })
    }
    if (user.status !== "approved") {
      return res.status(403).json({ error: "Account is not approved" })
    }
    req.userId = user._id.toString()
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: "Invalid token" })
  }
}
