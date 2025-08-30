export const getProfileImageUrl = (profileImage: string | null | undefined): string => {
  if (!profileImage) return ''
  
  // If it's already a full URL, return as is with cache busting
  if (profileImage.startsWith('http')) {
    return `${profileImage}?t=${Date.now()}`
  }
  
  // If it's a relative path, make it absolute with cache busting
  return `${profileImage}?t=${Date.now()}`
}

export const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget
  console.log('Image failed to load:', img.src)
  // Optionally set a default image
  // img.src = '/default-avatar.png'
}