import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, Body, Controller, Get, Header, Module, Post } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { GenerateOtpRequest, GenerateOtpResponse, ConnectVpnRequest } from '../../shared/src';
import { generateOtp } from './otp';
import { SophosService } from './sophos';

@Controller('api')
class OtpController {
  private readonly sophos = new SophosService();
  @Get('sophos/info') async info() {
    const { available, message } = await this.sophos.info();
    return { available, profiles: [], ...(message ? { message } : {}) };
  }
  @Post('sophos/connect')
  async connect(@Body() body: ConnectVpnRequest) {
    try { return await this.sophos.connect(body); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Bağlantı isteği işlenemedi.'); }
  }
  @Get('health') health() { return { status: 'ok' }; }
  @Post('otp/generate')
  @Header('Cache-Control', 'no-store')
  generate(@Body() body: GenerateOtpRequest): GenerateOtpResponse {
    try { return generateOtp(body); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Geçersiz istek.'); }
  }
}
@Module({ controllers: [OtpController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (!host || !['127.0.0.1:3000','localhost:3000'].includes(host)) return res.sendStatus(403);
    if (origin && !['http://localhost:4200','http://127.0.0.1:4200'].includes(origin)) return res.sendStatus(403);
    if (req.method === 'POST' && !req.is('application/json')) return res.sendStatus(415);
    next();
  });
  await app.listen(3000, '127.0.0.1');
  console.log('OTP API hazır: http://127.0.0.1:3000/api/health');
}
bootstrap().catch(() => { console.error('API başlatılamadı. 3000 portunu kontrol edin.'); process.exit(1); });

