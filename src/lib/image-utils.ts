export const getProfileImageUrl = (profileImage: string | null | undefined): string => {
  if (!profileImage) return ''
  
  // If it's a base64 data URL, validate and return
  if (profileImage.startsWith('data:')) {
    // Basic validation for data URL format
    if (profileImage.includes('base64,')) {
      return profileImage
    }
    console.warn('Invalid base64 data URL format:', profileImage.substring(0, 50))
    return ''
  }
  
  // If it's already a full URL, return as is with cache busting
  if (profileImage.startsWith('http')) {
    return `${profileImage}?t=${Date.now()}`
  }
  
  // If it's a relative path, make it absolute with cache busting
  return `${profileImage}?t=${Date.now()}`
}

export const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget
  console.error('Profile image failed to load:', {
    src: img.src,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    complete: img.complete
  })
  
  // Clear the src to prevent infinite loading attempts
  img.src = ''
}