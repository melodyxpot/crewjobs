import { describe, expect, it } from "vitest"
import { eventScheduleError } from "./calendar"

describe("calendar event schedule", () => {
  it("accepts an all-day event", () => {
    expect(
      eventScheduleError({ date: "2026-10-09", client: "Northwind", startTime: "", endTime: "" }),
    ).toBeNull()
  })

  it("accepts a timed event", () => {
    expect(
      eventScheduleError({
        date: "2026-10-09",
        client: "Northwind",
        startTime: "09:00",
        endTime: "10:30",
      }),
    ).toBeNull()
  })

  it("rejects a partial time range and an end before the start", () => {
    expect(
      eventScheduleError({ date: "2026-10-09", client: "Northwind", startTime: "09:00" }),
    ).toBe("Set both a start and an end time, or leave both empty for an all-day event.")
    expect(
      eventScheduleError({
        date: "2026-10-09",
        client: "Northwind",
        startTime: "11:00",
        endTime: "10:00",
      }),
    ).toBe("The end time has to be after the start time.")
  })

  it("rejects an impossible date and a missing client", () => {
    expect(eventScheduleError({ date: "2026-02-31", client: "Northwind" })).toBe(
      "Choose a valid date.",
    )
    expect(eventScheduleError({ date: "2026-10-09", client: "  " })).toBe("Client is required.")
  })
})
