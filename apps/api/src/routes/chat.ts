import { Router } from "express"
import mongoose from "mongoose"
import { authenticate, AuthRequest } from "../middleware/auth"
import { User } from "../models/User"
import { Conversation } from "../models/Conversation"
import { Message } from "../models/Message"
import { canChatWith, displayName, toPublicUser } from "../lib/roles"

const router = Router()
router.use(authenticate)

function pairKey(a: string, b: string) {
  return [a, b].sort()
}

async function findOrCreateConversation(userId: string, otherId: string) {
  const participants = pairKey(userId, otherId).map((id) => new mongoose.Types.ObjectId(id))
  let conversation = await Conversation.findOne({ participants: { $all: participants, $size: 2 } })
  if (!conversation) {
    conversation = await Conversation.create({ participants, lastMessage: "", lastMessageAt: null })
  }
  return conversation
}

router.get("/inbox", async (req: AuthRequest, res) => {
  try {
    const me = req.user!
    const users = await User.find({ status: "approved", _id: { $ne: me._id } }).select("-password")
    const contacts = users.filter((user) => canChatWith(me, user))
    const contactIds = contacts.map((user) => user._id)

    const conversations = await Conversation.find({
      participants: me._id,
    }).lean()

    const byOther = new Map<string, any>()
    for (const conversation of conversations) {
      const other = conversation.participants
        .map((id) => id.toString())
        .find((id) => id !== req.userId)
      if (other) byOther.set(other, conversation)
    }

    res.json({
      contacts: contacts
        .map((user) => {
          const conversation = byOther.get(user._id.toString())
          return {
            ...toPublicUser(user),
            displayName: displayName(user),
            conversationId: conversation?._id || null,
            lastMessage: conversation?.lastMessage || "",
            lastMessageAt: conversation?.lastMessageAt || null,
            lastSenderId: conversation?.lastSenderId || null,
          }
        })
        .sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          if (aTime !== bTime) return bTime - aTime
          return a.displayName.localeCompare(b.displayName)
        }),
      reachableIds: contactIds.map((id) => id.toString()),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to load inbox" })
  }
})

router.get("/messages/:userId", async (req: AuthRequest, res) => {
  try {
    const other = await User.findById(req.params.userId).select("-password")
    if (!other || other.status !== "approved")
      return res.status(404).json({ error: "User not found" })
    if (!canChatWith(req.user!, other)) {
      return res.status(403).json({ error: "You cannot message this user" })
    }

    const conversation = await Conversation.findOne({
      participants: { $all: [req.userId, other._id], $size: 2 },
    })
    if (!conversation) return res.json({ messages: [], conversationId: null })

    const since = req.query.since ? new Date(String(req.query.since)) : null
    const query: Record<string, unknown> = { conversationId: conversation._id }
    if (since && !Number.isNaN(since.getTime())) query.createdAt = { $gt: since }

    const messages = await Message.find(query).sort({ createdAt: 1 }).limit(200).lean()
    res.json({
      conversationId: conversation._id,
      messages: messages.map((message) => ({
        _id: message._id,
        body: message.body,
        senderId: message.senderId,
        createdAt: message.createdAt,
        mine: message.senderId.toString() === req.userId,
      })),
    })
  } catch {
    res.status(500).json({ error: "Failed to load messages" })
  }
})

router.post("/messages/:userId", async (req: AuthRequest, res) => {
  try {
    const body = String(req.body.body || "").trim()
    if (!body) return res.status(400).json({ error: "Message is empty" })
    if (body.length > 4000) return res.status(400).json({ error: "Message is too long" })

    const other = await User.findById(req.params.userId).select("-password")
    if (!other || other.status !== "approved")
      return res.status(404).json({ error: "User not found" })
    if (!canChatWith(req.user!, other)) {
      return res.status(403).json({ error: "You cannot message this user" })
    }

    const conversation = await findOrCreateConversation(req.userId!, other._id.toString())
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.userId,
      body,
    })
    conversation.lastMessage = body.slice(0, 180)
    conversation.lastMessageAt = message.createdAt
    conversation.lastSenderId = req.user!._id
    await conversation.save()

    res.status(201).json({
      message: {
        _id: message._id,
        body: message.body,
        senderId: message.senderId,
        createdAt: message.createdAt,
        mine: true,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to send message" })
  }
})

export { router as chatRouter }
