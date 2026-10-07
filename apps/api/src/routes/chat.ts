import { Router } from "express"
import mongoose from "mongoose"
import { authenticate, AuthRequest } from "../middleware/auth"
import { User } from "../models/User"
import { Conversation, IConversation } from "../models/Conversation"
import { Message } from "../models/Message"
import { canChatWith, displayName, isManager, toPublicUser } from "../lib/roles"
import { unfurl } from "../lib/unfurl"

const router = Router()
router.use(authenticate)

function mentionedHandles(body: string) {
  const handles: string[] = []
  const pattern = /(?:^|\s)@([a-zA-Z0-9_]+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(body))) handles.push(match[1].toLowerCase())
  return [...new Set(handles)]
}

function pairKey(a: string, b: string) {
  return [a, b].sort()
}

function readAtFor(
  conversation: { reads?: { userId: mongoose.Types.ObjectId; readAt: Date }[] },
  userId: string,
) {
  const entry = conversation.reads?.find((read) => read.userId.toString() === userId)
  return entry?.readAt || new Date(0)
}

async function touchRead(conversation: IConversation, userId: string) {
  const now = new Date()
  const reads = conversation.reads || []
  const existing = reads.find((read) => read.userId.toString() === userId)
  if (existing) existing.readAt = now
  else reads.push({ userId: new mongoose.Types.ObjectId(userId), readAt: now })
  conversation.reads = reads
  conversation.markModified("reads")
  await conversation.save()
}

async function unreadCount(conversationId: mongoose.Types.ObjectId, userId: string, since: Date) {
  return Message.countDocuments({
    conversationId,
    senderId: { $ne: userId },
    createdAt: { $gt: since },
  })
}

function senderOf(message: { senderId: any }) {
  const sender = message.senderId
  const id = sender?._id?.toString?.() || sender?.toString?.() || ""
  const name =
    sender && typeof sender === "object" && (sender.username || sender.name || sender.email)
      ? displayName(sender)
      : "Someone"
  return { id, name }
}

function presentMessage(message: any, userId: string) {
  const sender = senderOf(message)
  return {
    _id: message._id,
    body: message.body,
    senderId: sender.id,
    senderName: sender.name,
    createdAt: message.createdAt,
    mine: sender.id === userId,
  }
}

async function findOrCreateConversation(userId: string, otherId: string) {
  const participants = pairKey(userId, otherId).map((id) => new mongoose.Types.ObjectId(id))
  let conversation = await Conversation.findOne({
    participants: { $all: participants, $size: 2 },
    kind: { $ne: "channel" },
  })
  if (!conversation) {
    conversation = await Conversation.create({
      kind: "dm",
      participants,
      lastMessage: "",
      lastMessageAt: null,
    })
  }
  return conversation
}

async function approvedUsers(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  const users = await User.find({ _id: { $in: unique }, status: "approved" }).select("-password")
  if (users.length !== unique.length) return null
  return users
}

router.get("/unfurl", async (req: AuthRequest, res) => {
  try {
    const preview = await unfurl(String(req.query.url || ""))
    if (!preview) return res.status(404).json({ error: "No preview for that link" })
    res.json({ preview })
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Could not preview that link" })
  }
})

router.get("/unread", async (req: AuthRequest, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId }).lean()
    let count = 0
    let latest: {
      _id: string
      body: string
      senderName: string
      createdAt: Date
      conversationId: string
    } | null = null

    for (const conversation of conversations) {
      const since = readAtFor(conversation, req.userId!)
      const n = await unreadCount(conversation._id, req.userId!, since)
      count += n
      if (!n) continue
      const message = await Message.findOne({
        conversationId: conversation._id,
        senderId: { $ne: req.userId },
        createdAt: { $gt: since },
      })
        .sort({ createdAt: -1 })
        .populate("senderId", "username name email")
        .lean()
      if (!message) continue
      if (!latest || new Date(message.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
        const sender = senderOf(message)
        latest = {
          _id: message._id.toString(),
          body: message.body,
          senderName: sender.name,
          createdAt: message.createdAt,
          conversationId: conversation._id.toString(),
        }
      }
    }

    res.json({ count, latest })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to load notifications" })
  }
})

router.get("/inbox", async (req: AuthRequest, res) => {
  try {
    const me = req.user!
    const users = await User.find({ status: "approved", _id: { $ne: me._id } }).select("-password")
    const contacts = users.filter((user) => canChatWith(me, user))

    const conversations = await Conversation.find({ participants: me._id }).lean()
    const channels = []
    const byOther = new Map<string, (typeof conversations)[number]>()

    for (const conversation of conversations) {
      if (conversation.kind === "channel") {
        const since = readAtFor(conversation, req.userId!)
        channels.push({
          id: conversation._id.toString(),
          name: conversation.name || "channel",
          lastMessage: conversation.lastMessage || "",
          lastMessageAt: conversation.lastMessageAt || null,
          unread: await unreadCount(conversation._id, req.userId!, since),
          memberCount: conversation.participants.length,
        })
        continue
      }
      const other = conversation.participants
        .map((id) => id.toString())
        .find((id) => id !== req.userId)
      if (other) byOther.set(other, conversation)
    }

    const directs = []
    for (const user of contacts) {
      const conversation = byOther.get(user._id.toString())
      const since = conversation ? readAtFor(conversation, req.userId!) : new Date()
      directs.push({
        ...toPublicUser(user),
        displayName: displayName(user),
        conversationId: conversation?._id || null,
        lastMessage: conversation?.lastMessage || "",
        lastMessageAt: conversation?.lastMessageAt || null,
        unread: conversation ? await unreadCount(conversation._id, req.userId!, since) : 0,
      })
    }

    directs.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      if (aTime !== bTime) return bTime - aTime
      return a.displayName.localeCompare(b.displayName)
    })
    channels.sort((a, b) => a.name.localeCompare(b.name))

    res.json({
      channels,
      directs,
      contacts: directs,
      unread:
        channels.reduce((sum, channel) => sum + channel.unread, 0) +
        directs.reduce((sum, direct) => sum + direct.unread, 0),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to load inbox" })
  }
})

router.post("/channels", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can create a channel" })
    }
    const name = String(req.body.name || "")
      .trim()
      .replace(/^#/, "")
    if (!name || name.length > 80) {
      return res.status(400).json({ error: "Channel name is required" })
    }
    const memberIds = [
      ...new Set([req.userId!, ...((req.body.memberIds || []) as string[])].filter(Boolean)),
    ]
    const members = await approvedUsers(memberIds)
    if (!members) return res.status(400).json({ error: "Every member must be an approved user" })

    const conversation = await Conversation.create({
      kind: "channel",
      name,
      createdBy: req.userId,
      participants: memberIds,
      lastMessage: "",
      lastMessageAt: null,
      reads: [{ userId: req.userId, readAt: new Date() }],
    })
    res.status(201).json({
      channel: {
        id: conversation._id,
        name: conversation.name,
        memberCount: conversation.participants.length,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to create channel" })
  }
})

router.put("/channels/:id", async (req: AuthRequest, res) => {
  try {
    if (!isManager(req.user!)) {
      return res.status(403).json({ error: "Only a leader or moderator can update a channel" })
    }
    const channel = await Conversation.findOne({ _id: req.params.id, kind: "channel" })
    if (!channel) return res.status(404).json({ error: "Channel not found" })
    if (!channel.participants.some((id) => id.toString() === req.userId)) {
      return res.status(403).json({ error: "You are not in this channel" })
    }

    if (typeof req.body.name === "string") {
      const name = req.body.name.trim().replace(/^#/, "")
      if (!name || name.length > 80)
        return res.status(400).json({ error: "Channel name is required" })
      channel.name = name
    }

    if (Array.isArray(req.body.memberIds)) {
      const memberIds = [
        ...new Set(
          [req.userId!, channel.createdBy?.toString() || "", ...req.body.memberIds].filter(Boolean),
        ),
      ]
      const members = await approvedUsers(memberIds)
      if (!members) return res.status(400).json({ error: "Every member must be an approved user" })
      channel.participants = memberIds.map((id) => new mongoose.Types.ObjectId(id)) as any
    }

    await channel.save()
    const populated = await Conversation.findById(channel._id)
      .populate("participants", "email username name role")
      .lean()
    res.json({
      channel: {
        id: channel._id,
        name: channel.name,
        members: (populated?.participants || []).map((member: any) => ({
          ...toPublicUser(member),
          displayName: displayName(member),
        })),
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to update channel" })
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
      kind: { $ne: "channel" },
    })
    if (!conversation) return res.json({ messages: [], conversationId: null })

    const since = req.query.since ? new Date(String(req.query.since)) : null
    const query: Record<string, unknown> = { conversationId: conversation._id }
    if (since && !Number.isNaN(since.getTime())) query.createdAt = { $gt: since }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("senderId", "username name email")
      .lean()
    await touchRead(conversation, req.userId!)
    res.json({
      conversationId: conversation._id,
      messages: messages.map((message) => presentMessage(message, req.userId!)),
    })
  } catch (error) {
    console.error(error)
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
    await touchRead(conversation, req.userId!)

    res.status(201).json({
      message: {
        _id: message._id,
        body: message.body,
        senderId: req.userId,
        senderName: displayName(req.user!),
        createdAt: message.createdAt,
        mine: true,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to send message" })
  }
})

async function loadChannel(req: AuthRequest, id: string) {
  if (!mongoose.isValidObjectId(id)) {
    return { ok: false as const, error: "Channel not found", status: 404 }
  }
  const channel = await Conversation.findOne({ _id: id, kind: "channel" })
  if (!channel) return { ok: false as const, error: "Channel not found", status: 404 }
  if (!channel.participants.some((member) => member.toString() === req.userId)) {
    return { ok: false as const, error: "You are not in this channel", status: 403 }
  }
  return { ok: true as const, channel }
}

router.get("/channels/:id/messages", async (req: AuthRequest, res) => {
  try {
    const loaded = await loadChannel(req, String(req.params.id))
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const channel = loaded.channel
    const since = req.query.since ? new Date(String(req.query.since)) : null
    const query: Record<string, unknown> = { conversationId: channel._id }
    if (since && !Number.isNaN(since.getTime())) query.createdAt = { $gt: since }

    const [messages, populated] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: 1 })
        .limit(200)
        .populate("senderId", "username name email")
        .lean(),
      Conversation.findById(channel._id)
        .populate("participants", "email username name role")
        .lean(),
    ])
    await touchRead(channel, req.userId!)
    res.json({
      conversationId: channel._id,
      name: channel.name,
      canManage: isManager(req.user!),
      members: ((populated?.participants || []) as any[]).map((member) => ({
        ...toPublicUser(member),
        displayName: displayName(member),
      })),
      messages: messages.map((message) => presentMessage(message, req.userId!)),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to load channel" })
  }
})

router.post("/channels/:id/messages", async (req: AuthRequest, res) => {
  try {
    const body = String(req.body.body || "").trim()
    if (!body) return res.status(400).json({ error: "Message is empty" })
    if (body.length > 4000) return res.status(400).json({ error: "Message is too long" })

    const loaded = await loadChannel(req, String(req.params.id))
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error })
    const channel = loaded.channel
    const handles = mentionedHandles(body)
    if (handles.length) {
      const members = await User.find({ _id: { $in: channel.participants } }).select("username")
      const allowed = new Set(
        members.map((member) => (member.username || "").toLowerCase()).filter(Boolean),
      )
      if (handles.some((handle) => !allowed.has(handle))) {
        return res.status(400).json({ error: "You can only mention people in this channel" })
      }
    }
    const message = await Message.create({
      conversationId: channel._id,
      senderId: req.userId,
      body,
    })
    channel.lastMessage = body.slice(0, 180)
    channel.lastMessageAt = message.createdAt
    channel.lastSenderId = req.user!._id
    await touchRead(channel, req.userId!)

    res.status(201).json({
      message: {
        _id: message._id,
        body: message.body,
        senderId: req.userId,
        senderName: displayName(req.user!),
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
