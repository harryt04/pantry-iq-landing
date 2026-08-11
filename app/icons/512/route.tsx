import { IconMark } from '@/lib/icon-mark'
import { ImageResponse } from 'next/og'

export function GET() {
  return new ImageResponse(<IconMark scheme="light" />, {
    width: 512,
    height: 512,
  })
}
