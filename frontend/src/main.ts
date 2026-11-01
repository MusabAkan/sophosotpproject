import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { AppComponent } from './app/app.component';
async function start(){
  const session=await window.sophosDesktop?.session();
  await bootstrapApplication(AppComponent,{providers:[provideHttpClient(withInterceptors([(request,next)=>next(session && request.url.startsWith('/api/')?request.clone({setHeaders:{'X-App-Token':session.token}}):request)])),providePrimeNG({theme:{preset:Aura,options:{darkModeSelector:'.app-dark'}}})]});
}
void start().catch(()=>{document.body.textContent='Uygulama başlatılamadı. Lütfen Sophos OTP’yi yeniden başlat.';});

