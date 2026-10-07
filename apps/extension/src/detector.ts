export interface DetectedField {
  id: string
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  label: string
  type: "text" | "email" | "tel" | "url" | "textarea" | "select" | "checkbox" | "file" | "radio" | "date"
  profileKey: string | null
  filled: boolean
  groupName?: string
  aiAnswer?: string
}

function getFieldLabel(el: HTMLElement): string {
  // 1. Explicit label via for attribute
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`)
    if (label?.textContent?.trim()) return label.textContent.trim()
  }

  // 2. aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby")
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy)
    if (labelEl?.textContent?.trim()) return labelEl.textContent.trim()
  }

  // 3. aria-label
  if (el.getAttribute("aria-label")?.trim()) return el.getAttribute("aria-label")!.trim()

  // 4. Parent label element
  const parentLabel = el.closest("label")
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement
    clone.querySelectorAll("input,select,textarea,svg,img").forEach(c => c.remove())
    const text = clone.textContent?.trim()
    if (text) return text
  }

  // 5. Fieldset legend (especially for radio groups)
  const fieldset = el.closest("fieldset")
  if (fieldset) {
    const legend = fieldset.querySelector("legend")
    if (legend?.textContent?.trim()) return legend.textContent.trim()
  }

  // 6. Preceding sibling or nearby text
  const prev = el.previousElementSibling
  if (prev && ["LABEL", "SPAN", "P", "DIV"].includes(prev.tagName)) {
    const text = prev.textContent?.trim()
    if (text && text.length < 100) return text
  }

  // 7. Parent container label-like text
  const parent = el.parentElement
  if (parent) {
    const labelInParent = parent.querySelector("label, .label, [class*=label], [class*=Label]")
    if (labelInParent && labelInParent !== el) {
      const text = labelInParent.textContent?.trim()
      if (text) return text
    }
  }

  // 8. data-automation-id (Workday uses these)
  const automationId = el.getAttribute("data-automation-id")
  if (automationId) return automationId.replace(/[_\-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")

  // 9. Placeholder
  if ((el as HTMLInputElement).placeholder?.trim()) return (el as HTMLInputElement).placeholder.trim()

  // 10. Name attribute cleaned
  const name = el.getAttribute("name")
  if (name) return name.replace(/[\[\]_\-\.]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\d+/g, "").trim()

  // 11. Title attribute
  if (el.title?.trim()) return el.title.trim()

  return ""
}

function matchProfileKey(label: string, type: string, name: string): string | null {
  const l = label.toLowerCase()
  const n = (name || "").toLowerCase()
  const combined = `${l} ${n}`

  // Personal info
  if (combined.match(/first[\s_-]*name/)) return "firstName"
  if (combined.match(/last[\s_-]*name|surname|family[\s_-]*name/)) return "lastName"
  if (combined.match(/full[\s_-]*name|your[\s_-]*name|candidate[\s_-]*name/)) return "fullName"
  if (type === "email" || combined.match(/e[\-_\s]?mail/)) return "email"
  if (type === "tel" || combined.match(/phone|mobile|cell|telephone/)) return "phone"
  if (combined.match(/^address|street[\s_-]*address|address[\s_-]*line[\s_-]*1|address1|home[\s_-]*address/)) return "address"
  if (combined.match(/\bcity\b|town/)) return "city"
  if (combined.match(/\bstate\b|province|region/)) return "state"
  if (combined.match(/zip|postal[\s_-]*code|postcode/)) return "zipCode"
  if (combined.match(/\bcountry\b|nation/)) return "country"

  // Links  
  if (combined.match(/linkedin/)) return "linkedIn"
  if (combined.match(/github/)) return "github"
  if (combined.match(/portfolio|personal[\s_-]*website|website[\s_-]*url|personal[\s_-]*site/)) return "portfolio"

  // Professional
  if (combined.match(/summary|objective|about[\s_-]*you|cover[\s_-]*letter|additional[\s_-]*info|tell[\s_-]*us/)) return "summary"
  if (combined.match(/desired[\s_-]*salary|salary[\s_-]*expect|compensation/)) return "skip"
  if (combined.match(/start[\s_-]*date|earliest[\s_-]*start|available[\s_-]*from/)) return "skip"
  if (combined.match(/how[\s_-]*did[\s_-]*you[\s_-]*hear|referral[\s_-]*source|source/)) return "skip"

  // File uploads
  if (type === "file" && combined.match(/resume|cv/)) return "resumeFile"
  if (type === "file" && combined.match(/cover/)) return "coverLetterFile"
  if (type === "file") return "resumeFile"

  // Equal employment  
  if (combined.match(/authorized.*work|work.*authori[sz]|legally.*work|eligible.*work/)) return "ee.authorizedToWork"
  if (combined.match(/disabilit/)) return "ee.disability"
  if (combined.match(/\bgender\b|sex(?!ual)/)) return "ee.gender"
  if (combined.match(/sponsor|visa/)) return "ee.requireSponsorship"
  if (combined.match(/lgbtq/)) return "ee.lgbtq"
  if (combined.match(/veteran|military|served/)) return "ee.veteran"
  if (combined.match(/\brace\b|ethnic/)) return "ee.race"
  if (combined.match(/hispanic|latino|latina/)) return "ee.hispanicOrLatino"
  if (combined.match(/sexual[\s_-]*orientation/)) return "ee.sexualOrientation"

  return null
}

export function detectFormFields(): DetectedField[] {
  const fields: DetectedField[] = []
  const seen = new Set<HTMLElement>()
  const seenRadioGroups = new Set<string>()

  const selectors = [
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=search])",
    "textarea",
    "select"
  ].join(", ")

  const elements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selectors)

  elements.forEach((el, index) => {
    if (seen.has(el)) return
    if (el.closest("#crewjobs-sidebar-root") || el.closest("#crewjobs-fab")) return
    
    // Skip tiny/hidden elements (but allow file inputs which are often hidden)
    const inputType = (el as HTMLInputElement).type || "text"
    if (el.offsetParent === null && inputType !== "file" && inputType !== "hidden") {
      // Check if parent is visible (some frameworks hide the actual input)
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
    }

    seen.add(el)

    // Handle radio groups - group by name
    if (inputType === "radio") {
      const radioName = el.getAttribute("name") || ""
      if (radioName && seenRadioGroups.has(radioName)) return
      if (radioName) seenRadioGroups.add(radioName)
    }

    const type = (
      el.tagName === "TEXTAREA" ? "textarea"
      : el.tagName === "SELECT" ? "select"
      : inputType
    ) as DetectedField["type"]

    const label = getFieldLabel(el)
    const elName = el.getAttribute("name") || el.id || ""
    const profileKey = matchProfileKey(label, type, elName)

    fields.push({
      id: `crewjobs-field-${index}`,
      element: el,
      label: label || `Unlabeled ${type} field`,
      type,
      profileKey: profileKey === "skip" ? null : profileKey,
      filled: false,
      groupName: inputType === "radio" ? (el.getAttribute("name") || undefined) : undefined,
    })
  })

  return fields
}

export function getProfileValue(profile: any, key: string): any {
  if (key === "fullName") {
    return `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
  }
  if (key.startsWith("ee.")) {
    const eeKey = key.replace("ee.", "")
    return profile.equalEmployment?.[eeKey] || ""
  }
  return profile[key] || ""
}

export function fillField(field: DetectedField, value: any): boolean {
  const el = field.element
  try {
    // Radio buttons - find matching option in the group
    if (field.type === "radio" && field.groupName) {
      const radios = document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${field.groupName}"]`)
      const valLower = String(value).toLowerCase()
      let matched = false
      radios.forEach(radio => {
        const radioLabel = getFieldLabel(radio).toLowerCase()
        const radioValue = radio.value.toLowerCase()
        if (radioValue === valLower || radioLabel.includes(valLower) || valLower.includes(radioLabel)) {
          radio.checked = true
          radio.dispatchEvent(new Event("change", { bubbles: true }))
          radio.dispatchEvent(new Event("input", { bubbles: true }))
          radio.click()
          matched = true
        }
      })
      return matched
    }

    // Checkboxes
    if (field.type === "checkbox") {
      const input = el as HTMLInputElement
      const shouldCheck = value === true || value === "Yes" || value === "yes" || String(value).toLowerCase() === input.value.toLowerCase()
      if (input.checked !== shouldCheck) {
        input.click() // Use click() for React/framework compatibility
        if (input.checked !== shouldCheck) {
          input.checked = shouldCheck
          input.dispatchEvent(new Event("change", { bubbles: true }))
          input.dispatchEvent(new Event("input", { bubbles: true }))
        }
      }
      return true
    }

    // Select dropdowns
    if (field.type === "select") {
      const select = el as HTMLSelectElement
      const options = Array.from(select.options)
      const valLower = String(value).toLowerCase()
      
      // Try exact match first, then partial
      const match = options.find(opt => opt.value.toLowerCase() === valLower || opt.textContent?.trim().toLowerCase() === valLower)
        || options.find(opt => {
          const optText = (opt.textContent?.trim() || "").toLowerCase()
          return optText.includes(valLower) || valLower.includes(optText)
        })

      if (match) {
        select.value = match.value
        select.dispatchEvent(new Event("change", { bubbles: true }))
        select.dispatchEvent(new Event("input", { bubbles: true }))
        // For React-based forms
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
        if (nativeSetter) {
          nativeSetter.call(select, match.value)
          select.dispatchEvent(new Event("change", { bubbles: true }))
        }
        return true
      }
      return false
    }

    // File inputs
    if (field.type === "file") return false

    // Text-like inputs (text, email, tel, url, textarea, date)
    const proto = field.type === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set

    if (nativeSetter) {
      nativeSetter.call(el, String(value))
    } else {
      (el as HTMLInputElement).value = String(value)
    }

    el.dispatchEvent(new Event("focus", { bubbles: true }))
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new Event("blur", { bubbles: true }))

    // Also try dispatching React-specific synthetic events
    const reactEvent = new Event("input", { bubbles: true })
    Object.defineProperty(reactEvent, "target", { value: el })
    el.dispatchEvent(reactEvent)

    return true
  } catch {
    return false
  }
}

export async function attachFileToInput(input: HTMLInputElement, fileUrl: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(fileUrl)
    const blob = await response.blob()
    const file = new File([blob], filename, { type: blob.type || "application/pdf" })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    input.dispatchEvent(new Event("change", { bubbles: true }))
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return true
  } catch {
    return false
  }
}
