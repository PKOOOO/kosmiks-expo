---
description: Native provider salon profile edit screen
globs: ["**/app/(provider)/salon.tsx"]
alwaysApply: false
---

# Provider Screen: Salon Profile Edit

## File: `cosmix-v2/src/app/(provider)/salon.tsx`

## API Calls
```
GET /api/saloons/[id]    — fetch current salon data
PUT /api/saloons/[id]    — update salon profile
```

## Auth Header
```ts
const { getToken } = useAuth()
const token = await getToken()
headers: { Authorization: `Bearer ${token}` }
```

## Salon fields
```ts
type Salon = {
  id: string
  name: string
  description: string
  address: string
  phone: string
  email: string
  openingHours: {
    monday: { open: string, close: string, closed: boolean }
    tuesday: { open: string, close: string, closed: boolean }
    // ... all 7 days
  }
  images: string[]   // Cloudinary URLs
}
```

## UI Structure
```
<ScrollView>
  Section: Basic Info
    - Salon name (TextInput)
    - Description (TextInput multiline)
    - Phone (TextInput, phone keyboard)
    - Email (TextInput, email keyboard)
    - Address (TextInput)

  Section: Opening Hours
    - Row per day: [Day label] [Closed toggle] [Open time] [Close time]
    - If closed=true, grey out the time pickers for that day

  Section: Photos
    - Horizontal scroll of existing Cloudinary images
    - Note: "Update photos via web dashboard for now"
    
  [Save Changes button]
</ScrollView>
```

## Save flow
```ts
const handleSave = async () => {
  setLoading(true)
  try {
    await fetch(`/api/saloons/${saloonId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    showSuccessToast('Salon updated!')
  } catch (e) {
    showErrorToast('Failed to save, try again')
  } finally {
    setLoading(false)
  }
}
```

## Rules
- Fetch and pre-fill all fields on mount
- Disable Save button if no changes have been made
- Time picker: use simple HH:MM text input or a native time picker
- Do not implement image upload natively yet — note it as a placeholder
- Show unsaved changes warning if user tries to navigate away
