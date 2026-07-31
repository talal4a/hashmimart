import { supabase } from './supabase'

const BUCKET_NAME = 'product-images'
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const MAX_DIMENSION = 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateImageFile(file) {
  if (!file) throw new Error('No file selected')
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPG, JPEG, PNG and WEBP files are allowed.')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File size must be less than 5 MB.')
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(file)
        return
      }
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Image compression failed'))
        },
        file.type,
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to read image'))
    }
    img.src = url
  })
}

function uploadWithXhr(path, blob, mimeType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          reject(new Error(err.message || err.error || 'Upload failed'))
        } catch {
          reject(new Error('Upload failed'))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    const storageUrl = supabase.supabaseUrl.replace(/\/+$/, '')
    const endpoint = `${storageUrl}/storage/v1/object/${BUCKET_NAME}/${path}`
    xhr.open('POST', endpoint)
    xhr.setRequestHeader('Authorization', `Bearer ${supabase.supabaseKey}`)
    xhr.setRequestHeader('apikey', supabase.supabaseKey)
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.send(blob)
  })
}

export async function uploadProductImage(file, onProgress) {
  validateImageFile(file)
  const compressed = await compressImage(file)
  const ext = file.name.split('.').pop().toLowerCase().replace('jpeg', 'jpg')
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `products/${fileName}`
  const mimeType = compressed.type || file.type
  await uploadWithXhr(path, compressed, mimeType, onProgress)
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path)
  return publicUrl
}
