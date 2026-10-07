import { describe, expect, it } from "vitest"
import { collectListings } from "../run"
import {
  pageSizeFor,
  parseAdzuna,
  parseArbeitnow,
  parseJSearch,
  parseJobicy,
  parseRemoteOk,
  parseRemotive,
  parseTheMuse,
} from "./parse"

describe("source parsers", () => {
  it("reads a remote developer job from each public board", () => {
    expect(
      parseRemoteOk([
        { legal: "notice" },
        {
          position: "Backend Engineer",
          company: "Acme",
          location: "United States",
          apply_url: "https://remoteok.com/jobs/1?ref=home",
          description: "<p>Remote</p>",
        },
      ]),
    ).toMatchObject([
      { title: "Backend Engineer", company: "Acme", source: "remoteok", sourceIsRemoteBoard: true },
    ])

    expect(
      parseRemotive({
        jobs: [
          {
            title: "Frontend Developer",
            company_name: "North",
            url: "https://remotive.com/remote-jobs/1",
            candidate_required_location: "USA",
          },
        ],
      })[0],
    ).toMatchObject({ source: "remotive", location: "USA" })

    expect(
      parseArbeitnow({
        data: [
          {
            title: "QA Engineer",
            company_name: "Lab",
            url: "https://arbeitnow.com/1",
            remote: true,
          },
          {
            title: "QA Engineer",
            company_name: "Lab",
            url: "https://arbeitnow.com/2",
            remote: false,
          },
        ],
      }).map((job) => job.remoteHint),
    ).toEqual([true, false])

    expect(
      parseJobicy({
        jobs: [
          {
            jobTitle: "Data Engineer",
            companyName: "Peak",
            url: "https://jobicy.com/1",
            jobGeo: "asia",
          },
        ],
      })[0],
    ).toMatchObject({ location: "Asia", source: "jobicy" })
  })

  it("reads Adzuna, JSearch, and The Muse listings", () => {
    expect(
      parseAdzuna(
        {
          results: [
            {
              title: "Software Engineer",
              company: { display_name: "Ad Co" },
              location: { display_name: "London" },
              redirect_url: "https://adzuna.com/land/1",
              description: "Fully remote role",
            },
          ],
        },
        "United Kingdom",
      )[0],
    ).toMatchObject({
      company: "Ad Co",
      location: "London",
      source: "adzuna",
      sourceIsRemoteBoard: false,
      remoteHint: null,
    })

    expect(
      parseJSearch({
        data: [
          {
            job_title: "DevOps Engineer",
            employer_name: "Rapid",
            job_city: "Austin",
            job_country: "United States",
            job_apply_link: "https://example.com/apply",
            job_is_remote: true,
            job_publisher: "LinkedIn",
          },
        ],
      })[0],
    ).toMatchObject({
      location: "Austin, United States",
      platform: "LinkedIn",
      remoteHint: true,
      source: "jsearch",
    })

    const muse = parseTheMuse({
      results: [
        {
          name: "Full Stack Developer",
          company: { name: "Muse Co" },
          locations: [{ name: "Flexible / Remote" }, { name: "New York" }],
          refs: { landing_page: "https://www.themuse.com/jobs/1" },
          contents: "<p>Remote</p>",
        },
        {
          name: "Backend Engineer",
          company: { name: "Office Co" },
          locations: [{ name: "New York, NY" }],
          refs: { landing_page: "https://www.themuse.com/jobs/2" },
        },
      ],
    })
    expect(muse[0]).toMatchObject({ remoteHint: true, source: "themuse" })
    expect(muse[1]?.remoteHint).toBe(false)
  })
})

describe("collectListings", () => {
  it("keeps developer jobs for the selected regions and counts rejects and duplicates", () => {
    const parsed = [
      ...parseRemotive({
        jobs: [
          {
            title: "Frontend Developer",
            company_name: "North",
            url: "https://example.com/jobs/1?utm_source=remotive",
            candidate_required_location: "USA",
          },
          {
            title: "Frontend Developer",
            company_name: "North",
            url: "https://example.com/jobs/1?ref=again",
            candidate_required_location: "USA",
          },
          {
            title: "Sales Engineer",
            company_name: "North",
            url: "https://example.com/sales",
            candidate_required_location: "USA",
          },
          {
            title: "Backend Engineer",
            company_name: "Berlin Co",
            url: "https://example.com/berlin",
            candidate_required_location: "Germany",
          },
        ],
      }),
    ]
    const result = collectListings(parsed, ["US"])
    expect(result.listings).toHaveLength(1)
    expect(result.listings[0]).toMatchObject({
      region: "US",
      link: "https://example.com/jobs/1",
    })
    expect(result.duplicates).toBe(1)
    expect(result.rejected).toBe(2)
  })
})

describe("pageSizeFor", () => {
  it("spreads the per-region cap across the countries being queried", () => {
    expect(pageSizeFor(1)).toBe(50)
    expect(pageSizeFor(8)).toBe(7)
    expect(pageSizeFor(0)).toBe(0)
  })
})
