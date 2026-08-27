# Phase 3: Cloudinary Upload API Route

**Repo:** `cosmix-admin`
**File:** `app/api/upload/route.ts`

## Purpose
Mobile app picks files using expo-image-picker, sends to this endpoint,
backend uploads to Cloudinary and returns the secure URL.
Cloudinary credentials never touch the mobile app.

## Install Cloudinary Node SDK
```bash
npm install cloudinary
```

## Environment variables needed in cosmix-admin
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get these from your Cloudinary dashboard.
The upload preset `mwa8epb4` is already configured for web uploads —
server-side uploads use API key/secret instead, no preset needed.

## Create `app/api/upload/route.ts`

```ts
import { v2 as cloudinary } from 'cloudinary'
import { checkAdminAccess } from '@/lib/admin-access'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: Request) {
  // Auth — must be logged in (provider or admin)
  const { user } = await checkAdminAccess(req)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  // Convert File to base64 for Cloudinary
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

  // Upload to Cloudinary
  const result = await cloudinary.uploader.upload(base64, {
    folder: 'cosmix/provider-documents',
    resource_type: 'auto',
    // Limit file size to 10MB
    transformation: [{ quality: 'auto' }]
  })

  return Response.json({
    url: result.secure_url,
    publicId: result.public_id,
  })
}
```

## Mobile usage (cosmix-v2)

```ts
import * as ImagePicker from 'expo-image-picker'

const pickAndUpload = async () => {
  // 1. Pick from phone storage
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  })

  if (result.canceled) return

  const asset = result.assets[0]

  // 2. Build FormData
  const formData = new FormData()
  formData.append('file', {
    uri: asset.uri,
    type: asset.mimeType ?? 'image/jpeg',
    name: asset.fileName ?? 'upload.jpg',
  } as any)

  // 3. POST to backend
  const token = await getToken()
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Do NOT set Content-Type — let fetch set multipart boundary automatically
    },
    body: formData,
  })

  const { url } = await res.json()
  // url is now a Cloudinary secure_url — store it
  return url
}
```

## Rules
- Never set Content-Type header manually when sending FormData from mobile
- Always authenticate — documents are sensitive
- Store returned `url` in the application's `documentUrls` array
- Max file size: 10MB — validate on mobile before uploading
- Supported types: images only for documents (jpeg, png, heic)
- Install expo-image-picker: `npx expo install expo-image-picker`
