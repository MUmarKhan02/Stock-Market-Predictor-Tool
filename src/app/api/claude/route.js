import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()

    console.log('Calling Anthropic, key exists:', !!process.env.ANTHROPIC_API_KEY)
    console.log('Key starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 10))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    console.log('Anthropic status:', response.status)
    const data = await response.json()
    console.log('Anthropic response:', JSON.stringify(data).substring(0, 200))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Claude API error:', error.message)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}