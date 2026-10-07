import { User } from "../models/User"

function sanitizeUsername(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24)
  return cleaned || "user"
}

export async function nextUsername(base: string, excludeId?: string) {
  const root = sanitizeUsername(base)
  let candidate = root
  let n = 0
  while (true) {
    const existing = await User.findOne({
      username: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("_id")
    if (!existing) return candidate
    n += 1
    candidate = `${root}${n}`.slice(0, 30)
  }
}

export async function ensureAccounts() {
  const docs = await User.collection
    .find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: "" },
        { role: { $exists: false } },
        { status: { $exists: false } },
      ],
    })
    .toArray()

  for (const doc of docs) {
    const $set: Record<string, unknown> = {}
    if (!doc.username) {
      const fromEmail = String(doc.email || "user").split("@")[0]
      $set.username = await nextUsername(fromEmail, String(doc._id))
    }
    if (!doc.role) $set.role = "bidder"
    if (!doc.status) $set.status = "approved"
    if (Object.keys($set).length) {
      await User.collection.updateOne({ _id: doc._id }, { $set })
    }
  }

  const superAdmin = await User.findOne({ isSuperAdmin: true }).select("_id")
  if (!superAdmin) {
    const first = await User.findOne().sort({ createdAt: 1 })
    if (first) {
      first.isSuperAdmin = true
      first.role = "leader"
      first.status = "approved"
      if (!first.username) {
        first.username = await nextUsername(first.email.split("@")[0], first._id.toString())
      }
      await first.save()
      console.log(`Promoted ${first.email} to superadmin`)
    }
  }
}
