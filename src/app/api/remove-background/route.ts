import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image_file') as File;
    
    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Try remove.bg API first (requires API key)
    const removeBgApiKey = process.env.REMOVE_BG_API_KEY;
    
    if (removeBgApiKey) {
      try {
        const removeBgFormData = new FormData();
        removeBgFormData.append('image_file', imageFile);
        removeBgFormData.append('size', 'auto');

        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST',
          headers: {
            'X-Api-Key': removeBgApiKey,
          },
          body: removeBgFormData,
        });

        if (response.ok) {
          const resultBuffer = await response.arrayBuffer();
          return new NextResponse(resultBuffer, {
            headers: {
              'Content-Type': 'image/png',
            },
          });
        }
      } catch (error) {
        console.error('Remove.bg API error:', error);
      }
    }

    // Fallback: Use client-side processing
    return NextResponse.json({ 
      error: 'AI service unavailable', 
      fallback: true 
    }, { status: 503 });

  } catch (error) {
    console.error('Background removal error:', error);
    return NextResponse.json({ 
      error: 'Background removal failed',
      fallback: true 
    }, { status: 500 });
  }
}