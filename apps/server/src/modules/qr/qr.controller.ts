import { Controller, Get, Query, Res } from '@nestjs/common'
import QRCode from 'qrcode'

@Controller('qr')
export class QrController {
  @Get('classroom')
  async classroomQr(@Query('room') room = '', @Query('action') action = 'student', @Res() res: any) {
    const code = String(room || '').trim()
    if (!/^\d{6}$/.test(code)) {
      res.status(400).type('text/plain').send('Invalid room code')
      return
    }
    if (action !== 'teacher' && action !== 'student') {
      res.status(400).type('text/plain').send('Invalid QR action')
      return
    }

    const payload = action === 'teacher'
      ? `snyuan-classroom://teacher?room=${code}`
      : `snyuan-classroom://join?room=${code}`
    const svg = await QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: {
        dark: '#0a0d15',
        light: '#ffffff',
      },
    })

    res
      .status(200)
      .setHeader('Cache-Control', 'no-store')
      .type('image/svg+xml')
      .send(svg)
  }
}
