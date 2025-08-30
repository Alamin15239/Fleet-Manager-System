import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image_file') as File;
    
    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Try remove.bg API
    const removeBgApiKey = process.env.REMOVE_BG_API_KEY;
    
    if (!removeBgApiKey) {
      return NextResponse.json({ error: 'Remove.bg API key not configured' }, { status: 500 });
    }

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Remove.bg API error:', response.status, errorText);
        return NextResponse.json({ 
          error: `Remove.bg API error: ${response.status}`,
          details: errorText
        }, { status: response.status });
      }

      const resultBuffer = await response.arrayBuffer();
      return new NextResponse(resultBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': resultBuffer.byteLength.toString(),
        },
      });
    } catch (error) {
      console.error('Remove.bg API error:', error);
      return NextResponse.json({ 
        error: 'Failed to connect to Remove.bg API',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }



  } catch (error) {
    console.error('Background removal error:', error);
    return NextResponse.json({ 
      error: 'Background removal failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}