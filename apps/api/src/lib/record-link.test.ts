import { describe, expect, it } from "vitest"
import { parseRecordUrl, recordPath } from "./record-link"

const id = "507f1f77bcf86cd799439011"

describe("record links", () => {
  it("reads application, job, and calendar paths", () => {
    expect(parseRecordUrl(`http://localhost:3003/applications/${id}`)).toEqual({
      kind: "application",
      id,
    })
    expect(parseRecordUrl(`https://crewjobs.example/jobs/${id}/`)).toEqual({
      kind: "job",
      id,
    })
    expect(parseRecordUrl(`https://crewjobs.example/calendar/${id}?view=week`)).toEqual({
      kind: "event",
      id,
    })
    expect(recordPath("event", id)).toBe(`/calendar/${id}`)
  })

  it("reads query links and ignores other urls", () => {
    expect(parseRecordUrl(`https://crewjobs.example/calendar?event=${id}`)?.kind).toBe("event")
    expect(parseRecordUrl(`https://crewjobs.example/jobs?job=${id}`)?.kind).toBe("job")
    expect(parseRecordUrl(`https://crewjobs.example/applications?id=${id}`)?.kind).toBe(
      "application",
    )
    expect(parseRecordUrl("https://example.com/about")).toBeNull()
    expect(parseRecordUrl("https://example.com/applications/not-an-id")).toBeNull()
    expect(parseRecordUrl("not a url")).toBeNull()
  })
})
