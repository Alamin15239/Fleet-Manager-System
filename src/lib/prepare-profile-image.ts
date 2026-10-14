const MAX_DIMENSION = 512
const MAX_FILE_SIZE = 900 * 1024

function loadImage(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl)
    })
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('This image format is not supported on this device. Please choose a JPEG or PNG image.'))
    }
    image.src = objectUrl
  })
}

export async function prepareProfileImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.')
  }

  let source: { image: CanvasImageSource; width: number; height: number; cleanup: () => void }
  try {
    const bitmap = await createImageBitmap(file)
    source = {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close()
    }
  } catch {
    source = await loadImage(file)
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this image. Please try another photo.')
    context.drawImage(source.image, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.68, 0.52]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) break
      if (blob.size <= MAX_FILE_SIZE || quality === 0.52) {
        return new File([blob], 'profile-picture.jpg', { type: 'image/jpeg', lastModified: Date.now() })
      }
    }
    throw new Error('Could not compress this image. Please choose another photo.')
  } finally {
    source.cleanup()
  }
}
