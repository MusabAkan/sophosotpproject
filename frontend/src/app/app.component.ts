import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import type { GenerateOtpRequest, GenerateOtpResponse, OtpAlgorithm, SophosInfo, ConnectVpnResponse, AppLanguage, SavedProfile, ProfileCatalog, ProfileInput } from '../../../shared/src';

import {translate,languages,DEFAULT_LANGUAGE,type MessageKey} from './i18n';

@Component({ selector: 'app-root', standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, InputNumberModule, ProgressBarModule, MessageModule],
  templateUrl: './app.component.html' })
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  readonly languages=languages;
  readonly language=signal<AppLanguage>(DEFAULT_LANGUAGE);
  readonly saving=signal(false);readonly restoring=signal(false);
  readonly catalog=signal<ProfileCatalog>({profiles:[],selectedId:null,legacyPending:false});
  readonly selectedId=signal<string|null>(null);readonly profileChoice=signal<string|null>(null);
  readonly pendingSwitch=signal<{id:string|null}|null>(null);readonly confirmDelete=signal(false);
  readonly storageReady=signal(false);
  profileName='';remember=true;
  private revision:number|undefined;private baseline='';private destroyed=false;
  t(key:MessageKey){return translate(this.language(),key);}
  setLanguage(value:AppLanguage){this.language.set(value);document.documentElement.lang=value;}
  profileOptions(){return this.catalog().profiles.map(profile=>({...profile,label:profile.readable?profile.name:this.t('unreadableProfile')}));}
  sessionBusy(){return this.saving()||this.restoring()||this.connecting()||this.qrBusy()||this.busy();}
  private snapshot(){return JSON.stringify({name:this.profileName,profile:this.profile,username:this.username,password:this.password,otp:this.config,input:this.input,algorithm:this.algorithm,period:this.period,digits:this.digits,language:this.language()});}
  dirty(){return !!this.baseline&&this.snapshot()!==this.baseline;}
  private markClean(){this.baseline=this.snapshot();}
  private profileError(error:unknown,fallback:MessageKey){
    const code=error instanceof HttpErrorResponse?error.error?.code:'';
    const messages:Record<string,MessageKey>={ENCRYPTION_UNAVAILABLE:'encryptionUnavailable',PROFILE_CONFLICT:'profileConflict',PROFILE_NOT_FOUND:'profileNotFound',DECRYPTION_FAILED:'restoreFailed',INVALID_PROFILE:'invalidProfile'};
    this.error.set(this.t(messages[code]??fallback));
  }
  private async refreshProfiles(){this.catalog.set(await firstValueFrom(this.http.get<ProfileCatalog>('/api/profiles')));this.storageReady.set(true);}
  private async restoreProfiles(){
    this.markClean();this.restoring.set(true);
    try{await this.refreshProfiles();}catch(error){this.profileError(error,'catalogFailed');}
    finally{this.restoring.set(false);}
    if(!this.destroyed&&this.catalog().selectedId)await this.switchProfile(this.catalog().selectedId);
  }
  async requestProfile(id:string|null){
    if(this.sessionBusy()||this.pendingSwitch())return;
    if(id!==null&&id===this.selectedId())return;
    this.profileChoice.set(id);this.confirmDelete.set(false);
    if(this.dirty()){this.pendingSwitch.set({id});return;}
    await this.switchProfile(id);
  }
  cancelProfileSwitch(){this.pendingSwitch.set(null);this.profileChoice.set(this.selectedId());}
  async continueProfileSwitch(save:boolean){
    const target=this.pendingSwitch();if(!target||this.sessionBusy())return;
    if(save&&!await this.saveProfile())return;
    this.pendingSwitch.set(null);await this.switchProfile(target.id);
  }
  private resetFields(){
    this.hideCredentials();
    this.clear();this.input='';this.profileName='';this.username='';this.password='';this.profile='';
    this.algorithm='SHA1';this.period=30;this.digits=6;this.revision=undefined;
    this.error.set('');this.confirmDelete.set(false);
  }
  private async switchProfile(id:string|null){
    this.restoring.set(true);this.resetFields();this.selectedId.set(id);this.profileChoice.set(id);
    const version=this.version;
    try{
      if(id){
        const saved=await firstValueFrom(this.http.post<SavedProfile>('/api/profiles/load',{id}));
        if(this.destroyed||version!==this.version)return;
        this.profileName=saved.name;this.revision=saved.revision;this.profile=saved.profile;this.username=saved.username;this.password=saved.password;
        this.setLanguage(saved.language);
        if(saved.otp){this.config={...saved.otp};this.algorithm=saved.otp.algorithm;this.period=saved.otp.period;this.digits=saved.otp.digits;await this.refresh(this.version);}
        if(!this.error())this.notice.set(this.t('restored'));
      }
    }catch(error){this.profileError(error,'restoreFailed');}
    finally{if(!this.destroyed){this.markClean();this.restoring.set(false);}}
  }
  async saveProfile(asNew=false){
    if(this.saving()||this.restoring()||this.connecting()||this.qrBusy()||this.busy())return false;
    if(!this.profileName.trim()){this.error.set(this.t('nameRequired'));return false;}
    this.saving.set(true);this.error.set('');this.notice.set('');
    try{
      if(this.input.trim()||(this.config&&(this.algorithm!==this.config.algorithm||this.period!==this.config.period||this.digits!==this.config.digits))){if(!await this.start())return false;}
      const value:ProfileInput={version:2,name:this.profileName,provider:'sophos',language:this.language(),profile:this.profile,username:this.username,password:this.password,otp:this.config?{...this.config}:null,
        ...(!asNew&&this.selectedId()?{id:this.selectedId()!,revision:this.revision}:{})};
      const saved=await firstValueFrom(this.http.post<SavedProfile>('/api/profiles/save',value));
      if(this.destroyed)return false;
      this.selectedId.set(saved.id);this.profileChoice.set(saved.id);this.revision=saved.revision;this.profileName=saved.name;this.markClean();
      this.notice.set(this.t('saved'));
      try{await this.refreshProfiles();}catch{this.error.set(this.t('catalogFailed'));}
      return true;
    }catch(error){this.profileError(error,'saveFailed');return false;}finally{this.saving.set(false);}
  }
  async deleteSaved(){
    const id=this.selectedId();if(!id||!this.confirmDelete()||this.sessionBusy())return;
    this.saving.set(true);this.error.set('');
    try{
      await firstValueFrom(this.http.post('/api/profiles/remove',{id}));
      this.resetFields();this.selectedId.set(null);this.profileChoice.set(null);this.markClean();this.notice.set(this.t('deleted'));
      await this.refreshProfiles();
    }catch(error){this.profileError(error,'deletionFailed');}finally{this.saving.set(false);}
  }
  input = ''; algorithm: OtpAlgorithm = 'SHA1'; period = 30; digits: 6 | 8 = 6;
  readonly algorithms = ['SHA1','SHA256','SHA512']; readonly digitOptions = [6,8];
  readonly busy = signal(false); readonly qrBusy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly result = signal<GenerateOtpResponse | null>(null); readonly remaining = signal(0);
  readonly active = signal(false); readonly account = signal('Local account');
  readonly progress = computed(() => this.result() ? this.remaining() / this.result()!.period * 100 : 0);
  readonly displayCode = computed(() => { const value = this.result()?.code; return value ? value.slice(0,value.length / 2) + ' ' + value.slice(value.length / 2) : '••• •••'; });
  private config: GenerateOtpRequest | null = null;
  username = ''; password = ''; profile = '';
  readonly connectionVisible = signal(false);
  readonly usernameVisible = signal(false);
  readonly passwordVisible = signal(false);

  credentialsLocked(): boolean {
    return this.saving() || this.restoring() || this.connecting() || !!this.pendingSwitch();
  }

  toggleConnectionVisibility(): void {
    if (!this.credentialsLocked()) {
      this.connectionVisible.update(visible => !visible);
    }
  }

  togglePasswordVisibility(): void {
    if (!this.credentialsLocked()) {
      this.passwordVisible.update(visible => !visible);
    }
  }

  toggleUsernameVisibility(): void {
    if (!this.credentialsLocked()) {
      this.usernameVisible.update(visible => !visible);
    }
  }

  private hideCredentials(): void {
    // Visibility belongs to the current screen, never to a saved profile.
    this.connectionVisible.set(false);
    this.usernameVisible.set(false);
    this.passwordVisible.set(false);
  }

  readonly sophos = signal<SophosInfo | null>(null);
  readonly infoBusy = signal(false); readonly connecting = signal(false);
  private version = 0; private offset = 0;
  private timer = setInterval(() => this.tick(), 200);

  async start() {
    if (this.busy() || this.restoring() || this.connecting() || this.qrBusy()) return false;
    const previous=this.config;
    this.clear(); this.error.set(''); this.notice.set('');
    try {
      const config: GenerateOtpRequest = { secret: this.input.trim() || previous?.secret || '', algorithm: this.algorithm, period: this.period, digits: this.digits };
      if (config.secret.startsWith('otpauth://')) {
        const uri = new URL(config.secret);
        if (uri.hostname !== 'totp') throw new Error(this.t('invalidSetup'));
        config.secret = uri.searchParams.get('secret') ?? '';
        config.algorithm = (uri.searchParams.get('algorithm') ?? 'SHA1').toUpperCase() as OtpAlgorithm;
        config.period = Number(uri.searchParams.get('period') ?? 30);
        config.digits = Number(uri.searchParams.get('digits') ?? 6) as 6 | 8;
        this.account.set(decodeURIComponent(uri.pathname.slice(1)).slice(0,80) || 'Local account');
      }
      if (!config.secret) throw new Error(this.t('missingSecret'));
      this.config = config;
      await this.refresh(this.version);
      if (this.active()) { this.algorithm = config.algorithm; this.period = config.period; this.digits = config.digits; this.input = ''; return true; }
    } catch (error) { this.error.set(this.t('invalidSetup')); }
    return false;
  }
  private async refresh(version: number) {
    if (!this.config || this.busy()) return;
    this.busy.set(true);
    const sent = Date.now();
    try {
      const result = await firstValueFrom(this.http.post<GenerateOtpResponse>('/api/otp/generate', this.config));
      if (version !== this.version) return;
      this.offset = result.serverTime - (sent + Date.now()) / 2;
      this.result.set(result); this.active.set(true); this.error.set(''); this.updateRemaining();
    } catch (error) {
      if (version !== this.version) return;
      this.result.set(null); this.active.set(false); if(error instanceof HttpErrorResponse && error.status===400)this.config = null;
      const message = error instanceof HttpErrorResponse ? error.error?.message : '';
      this.error.set(this.language()==='en' && typeof message==='string' && message ? message : this.t('requestFailed'));
    } finally { if (version === this.version) this.busy.set(false); }
  }
  private updateRemaining() { const result = this.result(); this.remaining.set(result ? Math.max(0, Math.ceil((result.validUntil - Date.now() - this.offset) / 1000)) : 0); }
  private tick() { this.updateRemaining(); if (this.active() && !this.remaining() && !this.busy()) void this.refresh(this.version); }
  clear() { this.version++; this.config = null; this.result.set(null); this.active.set(false); this.busy.set(false); this.remaining.set(0); this.notice.set(''); this.account.set('Local account'); }
  forget() { this.resetFields(); this.selectedId.set(null); this.profileChoice.set(null); this.pendingSwitch.set(null); this.markClean(); this.notice.set(this.t('cleared')); }
  ngOnInit() { void this.loadSophos(); void this.restoreProfiles(); }
  async loadSophos() {
    if (this.infoBusy()) return;
    this.infoBusy.set(true);
    try {
      const info = await firstValueFrom(this.http.get<SophosInfo>('/api/sophos/info'));
      this.sophos.set(info);

    } catch { this.sophos.set({ available: false, profiles: [], message: 'Cannot load Sophos status.' }); }
    finally { this.infoBusy.set(false); }
  }
  async copyUsername() {
    try { await navigator.clipboard.writeText(this.username); this.notice.set(this.t('userCopied')); }
    catch { this.error.set(this.t('copyFailed')); }
  }
  async copyCombined() {
    this.updateRemaining();
    if (!this.password || !this.result() || this.remaining() <= 5 || this.busy()) {
      this.error.set(this.t('waitCode')); return;
    }
    try { await navigator.clipboard.writeText(this.password + this.result()!.code); this.notice.set(this.t('combinedCopied')); }
    catch { this.error.set(this.t('copyFailed')); }
  }
  async connectVpn() {
    if (this.sessionBusy() || this.pendingSwitch() || !this.config || !this.active()) return;
    this.error.set(''); this.notice.set('');
    if (!this.username.trim() || !this.password || !this.profile) { this.error.set(this.t('missingCredentials')); return; }
    if(this.remember){if(!this.profileName.trim())this.profileName=this.profile;if(!await this.saveProfile())return;}
    this.connecting.set(true);
    const version = this.version;
    try {
      const response = await firstValueFrom(this.http.post<ConnectVpnResponse>('/api/sophos/connect', {
        profile: this.profile, username: this.username, password: this.password, otp: { ...this.config }
      }));
      if (version === this.version) this.notice.set(this.t('submitted'));
    } catch (error) {
      if (version !== this.version) return;
      const message = error instanceof HttpErrorResponse ? error.error?.message : '';
      this.error.set(this.language()==='en' && typeof message==='string' && message ? message : this.t('requestFailed'));
    } finally { this.connecting.set(false); }
  }
  async copy() {
    if (!this.result() || !this.remaining() || this.busy()) return;
    try { await navigator.clipboard.writeText(this.result()!.code); this.notice.set(this.t('copied')); }
    catch { this.error.set(this.t('copyFailed')); }
  }
  async readQr(event: Event) {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0]; if (!file) return;
    this.error.set(''); this.notice.set('');
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { this.error.set(this.t('qrSize')); field.value = ''; return; }
    const qrVersion=this.version;
    this.qrBusy.set(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const text = (await new BrowserQRCodeReader().decodeFromImageUrl(url)).getText();
      if (!text.startsWith('otpauth://totp/')) throw new Error();
      if(qrVersion!==this.version)return;
      this.input = text; this.notice.set(this.t('qrReady'));
    } catch { this.error.set(this.t('qrInvalid')); }
    finally { URL.revokeObjectURL(url); field.value = ''; this.qrBusy.set(false); }
  }
  ngOnDestroy() { this.destroyed=true; clearInterval(this.timer); this.forget(); }
}
