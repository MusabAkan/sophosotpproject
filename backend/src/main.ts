import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, Body, Controller, Get, Header, Module, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import type { GenerateOtpRequest, GenerateOtpResponse, ConnectVpnRequest } from '../../shared/src';
import { generateOtp } from './otp';
import { SophosService } from './sophos';
@Controller('api')
class OtpController {
  private readonly sophos = new SophosService();
  @Get('sophos/info') async info() { const {available,message}=await this.sophos.info(); return {available,profiles:[],...(message?{message}:{})}; }
  @Post('sophos/connect') async connect(@Body() body: ConnectVpnRequest) {
    try{return await this.sophos.connect(body);}catch(error){throw new BadRequestException(error instanceof Error?error.message:'Connection request failed.');}
  }
  @Get('health') health(){return {status:'ok'};}
  @Post('otp/generate') @Header('Cache-Control','no-store')
  generate(@Body() body:GenerateOtpRequest):GenerateOtpResponse {
    try{return generateOtp(body);}catch(error){throw new BadRequestException(error instanceof Error?error.message:'Invalid request.');}
  }
}
@Module({controllers:[OtpController]}) class AppModule {}
export async function createApi(options:{token?:string;port?:number;staticDirectory?:string}={}){
  const app=await NestFactory.create<NestExpressApplication>(AppModule,{logger:['error','warn']});
  app.disable('x-powered-by');
  app.use((req:Request,res:Response,next:NextFunction)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(options.staticDirectory)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    const port=req.socket.localPort;
    const hosts=['127.0.0.1:'+port,'localhost:'+port];
    if(!req.headers.host||!hosts.includes(req.headers.host))return res.sendStatus(403);
    const origins=['http://127.0.0.1:'+port,'http://localhost:'+port,...(options.token?[]:['http://localhost:4200','http://127.0.0.1:4200'])];
    if(req.headers.origin&&!origins.includes(req.headers.origin))return res.sendStatus(403);
    if(req.path.startsWith('/api/')&&options.token&&req.headers['x-app-token']!==options.token)return res.sendStatus(401);
    if(req.method==='POST'&&!req.is('application/json'))return res.sendStatus(415);
    next();
  });
  if(options.staticDirectory)app.useStaticAssets(options.staticDirectory);
  await app.listen(options.port??3000,'127.0.0.1');return app;
}
if(require.main===module)createApi().then(()=>console.log('OTP API ready: http://127.0.0.1:3000/api/health')).catch(()=>{console.error('Could not start the API. Check port 3000.');process.exitCode=1;});
