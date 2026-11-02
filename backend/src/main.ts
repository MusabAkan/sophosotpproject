import 'reflect-metadata';
import {randomBytes} from 'node:crypto';
import {NestFactory} from '@nestjs/core';
import {BadRequestException,Body,Controller,Get,Header,HttpException,Inject,Module,Post} from '@nestjs/common';
import type {NestExpressApplication} from '@nestjs/platform-express';
import type {Request,Response,NextFunction} from 'express';
import {openVault,ProfileVault,VaultError} from '@sophos-otp/storage';
import type {GenerateOtpRequest,GenerateOtpResponse,ConnectVpnRequest,ProfileInput} from '../../shared/src';
import {generateOtp} from './otp';
import {SophosService} from './sophos';
@Controller('api')
class OtpController {
  private readonly sophos=new SophosService();
  @Get('sophos/info') async info(){const {available,message}=await this.sophos.info();return {available,profiles:[],...(message?{message}:{})};}
  @Post('sophos/connect') async connect(@Body() body:ConnectVpnRequest){
    try{return await this.sophos.connect(body);}catch(error){throw new BadRequestException(error instanceof Error?error.message:'Connection request failed.');}
  }
  @Get('health') health(){return {status:'ok'};}
  @Post('otp/generate') @Header('Cache-Control','no-store') generate(@Body() body:GenerateOtpRequest):GenerateOtpResponse {
    try{return generateOtp(body);}catch(error){throw new BadRequestException(error instanceof Error?error.message:'Invalid request.');}
  }
}
@Controller('api/profiles')
class ProfilesController {
  constructor(@Inject('PROFILE_VAULT') private readonly vault:ProfileVault|null){}
  private async operation<T>(action:(vault:ProfileVault)=>Promise<T>):Promise<T>{
    if(!this.vault)throw new HttpException({code:'STORAGE_UNAVAILABLE',message:'Profile storage is unavailable.'},503);
    try{return await action(this.vault);}catch(error){
      if(error instanceof VaultError){
        const status=error.code==='PROFILE_NOT_FOUND'?404:error.code==='INVALID_PROFILE'?400:error.code==='ENCRYPTION_UNAVAILABLE'?503:409;
        throw new HttpException({code:error.code,message:error.message},status);
      }
      throw new HttpException({code:'STORAGE_FAILED',message:'The local profile operation failed.'},500);
    }
  }
  @Get() list(){return this.operation(vault=>vault.list());}
  @Post('load') load(@Body() body:{id:string}){return this.operation(async vault=>{const value=await vault.load(body?.id);await vault.select(value.id);return value;});}
  @Post('save') save(@Body() body:ProfileInput){return this.operation(vault=>vault.save(body));}
  @Post('select') select(@Body() body:{id:string|null}){return this.operation(async vault=>{await vault.select(body?.id);return {selected:true};});}
  @Post('remove') remove(@Body() body:{id:string}){return this.operation(async vault=>{await vault.remove(body?.id);return {removed:true};});}
}
export async function createApi(options:{token?:string;port?:number;staticDirectory?:string;vault?:ProfileVault}={}){
  const token=options.token??randomBytes(32).toString('hex');
  @Module({controllers:[OtpController,ProfilesController],providers:[{provide:'PROFILE_VAULT',useValue:options.vault??null}]}) class AppModule {}
  const app=await NestFactory.create<NestExpressApplication>(AppModule,{logger:['error','warn']});
  app.disable('x-powered-by');
  app.use((req:Request,res:Response,next:NextFunction)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(options.staticDirectory)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    const port=req.socket.localPort,hosts=['127.0.0.1:'+port,'localhost:'+port];
    if(!req.headers.host||!hosts.includes(req.headers.host))return res.sendStatus(403);
    const origins=['http://127.0.0.1:'+port,'http://localhost:'+port,...(options.staticDirectory?[]:['http://localhost:4200','http://127.0.0.1:4200'])];
    if(req.headers.origin&&!origins.includes(req.headers.origin))return res.sendStatus(403);
    if(req.path==='/api/session'){
      // No CORS permissions: the custom header prevents cross-origin simple requests.
      if(req.method!=='GET'||req.headers['x-otp-client']!=='sophos-otp')return res.sendStatus(403);
      return res.json({token});
    }
    if(req.path.startsWith('/api/')&&req.headers['x-app-token']!==token)return res.sendStatus(401);
    if(req.method==='POST'&&!req.is('application/json'))return res.sendStatus(415);
    next();
  });
  if(options.staticDirectory)app.useStaticAssets(options.staticDirectory);
  await app.listen(options.port??3000,'127.0.0.1');return app;
}
if(require.main===module){
  const vault=openVault();
  createApi({vault}).then(app=>{
    console.log('OTP API ready: http://127.0.0.1:3000/api/health');
    async function close(){await app.close();vault.close();process.exit(0);}
    process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
  }).catch(()=>{vault.close();console.error('Could not start the API. Check port 3000 and the local data directory.');process.exitCode=1;});
}
