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
import type { GenerateOtpRequest, GenerateOtpResponse, OtpAlgorithm, SophosInfo, ConnectVpnResponse } from '../../../shared/src';

@Component({ selector: 'app-root', standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, InputNumberModule, ProgressBarModule, MessageModule],
  templateUrl: './app.component.html' })
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  input = ''; algorithm: OtpAlgorithm = 'SHA1'; period = 30; digits: 6 | 8 = 6;
  readonly algorithms = ['SHA1','SHA256','SHA512']; readonly digitOptions = [6,8];
  readonly busy = signal(false); readonly qrBusy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly result = signal<GenerateOtpResponse | null>(null); readonly remaining = signal(0);
  readonly active = signal(false); readonly account = signal('Yerel hesap');
  readonly progress = computed(() => this.result() ? this.remaining() / this.result()!.period * 100 : 0);
  readonly displayCode = computed(() => { const value = this.result()?.code; return value ? value.slice(0,value.length / 2) + ' ' + value.slice(value.length / 2) : '••• •••'; });
  private config: GenerateOtpRequest | null = null;
  username = ''; password = ''; profile = '';
  readonly sophos = signal<SophosInfo | null>(null);
  readonly infoBusy = signal(false); readonly connecting = signal(false);
  private version = 0; private offset = 0;
  private timer = setInterval(() => this.tick(), 200);

  async start() {
    if (this.busy()) return;
    this.clear(); this.error.set(''); this.notice.set('');
    try {
      const config: GenerateOtpRequest = { secret: this.input.trim(), algorithm: this.algorithm, period: this.period, digits: this.digits };
      if (config.secret.startsWith('otpauth://')) {
        const uri = new URL(config.secret);
        if (uri.hostname !== 'totp') throw new Error('Yalnızca TOTP QR kodları desteklenir.');
        config.secret = uri.searchParams.get('secret') ?? '';
        config.algorithm = (uri.searchParams.get('algorithm') ?? 'SHA1').toUpperCase() as OtpAlgorithm;
        config.period = Number(uri.searchParams.get('period') ?? 30);
        config.digits = Number(uri.searchParams.get('digits') ?? 6) as 6 | 8;
        this.account.set(decodeURIComponent(uri.pathname.slice(1)).slice(0,80) || 'Yerel hesap');
      }
      if (!config.secret) throw new Error('Önce kurulum anahtarını girin veya QR görseli seçin.');
      this.config = config;
      await this.refresh(this.version);
      if (this.active()) this.input = '';
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Kurulum bilgisi okunamadı.'); }
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
      this.result.set(null); this.active.set(false); this.config = null;
      const message = error instanceof HttpErrorResponse ? error.error?.message : '';
      this.error.set(typeof message === 'string' ? message : 'Backend’e ulaşılamadı. Başlatıcıyı ve 3000 portunu kontrol edin.');
    } finally { if (version === this.version) this.busy.set(false); }
  }
  private updateRemaining() { const result = this.result(); this.remaining.set(result ? Math.max(0, Math.ceil((result.validUntil - Date.now() - this.offset) / 1000)) : 0); }
  private tick() { this.updateRemaining(); if (this.active() && !this.remaining() && !this.busy()) void this.refresh(this.version); }
  clear() { this.version++; this.config = null; this.result.set(null); this.active.set(false); this.busy.set(false); this.remaining.set(0); this.notice.set(''); this.account.set('Yerel hesap'); }
  forget() { this.clear(); this.input = ''; this.username = ''; this.password = ''; this.profile = ''; this.error.set(''); this.notice.set('Oturum temizlendi.'); }
  ngOnInit() { void this.loadSophos(); }
  async loadSophos() {
    if (this.infoBusy()) return;
    this.infoBusy.set(true);
    try {
      const info = await firstValueFrom(this.http.get<SophosInfo>('/api/sophos/info'));
      this.sophos.set(info);

    } catch { this.sophos.set({ available: false, profiles: [], message: 'Sophos bilgisi alınamadı. Backend’i güncelleyip yeniden başlat.' }); }
    finally { this.infoBusy.set(false); }
  }
  async copyUsername() {
    try { await navigator.clipboard.writeText(this.username); this.notice.set('Kullanıcı adı kopyalandı.'); }
    catch { this.error.set('Panoya erişilemedi.'); }
  }
  async copyCombined() {
    this.updateRemaining();
    if (!this.password || !this.result() || this.remaining() <= 5 || this.busy()) {
      this.error.set('Mevcut şifreni gir; kodun en az 5 saniyesi kaldığından emin ol.'); return;
    }
    try { await navigator.clipboard.writeText(this.password + this.result()!.code); this.notice.set('Şifre + OTP kopyalandı. Kod bitmeden Sophos’a yapıştır.'); }
    catch { this.error.set('Panoya erişilemedi.'); }
  }
  async connectVpn() {
    if (this.connecting() || !this.config || !this.active()) return;
    this.error.set(''); this.notice.set('');
    if (!this.username.trim() || !this.password || !this.profile) { this.error.set('Bağlantı, kullanıcı adı ve mevcut şifreyi doldur.'); return; }
    this.connecting.set(true);
    const version = this.version;
    try {
      const response = await firstValueFrom(this.http.post<ConnectVpnResponse>('/api/sophos/connect', {
        profile: this.profile, username: this.username, password: this.password, otp: { ...this.config }
      }));
      if (version === this.version) this.notice.set(response.message);
    } catch (error) {
      if (version !== this.version) return;
      const message = error instanceof HttpErrorResponse ? error.error?.message : '';
      this.error.set(typeof message === 'string' ? message : 'Sophos’a ulaşılamadı. Backend’i kontrol et.');
    } finally { this.connecting.set(false); }
  }
  async copy() {
    if (!this.result() || !this.remaining() || this.busy()) return;
    try { await navigator.clipboard.writeText(this.result()!.code); this.notice.set('Kod panoya kopyalandı.'); }
    catch { this.error.set('Panoya erişilemedi. Kodu elle kopyalayabilirsiniz.'); }
  }
  async readQr(event: Event) {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0]; if (!file) return;
    this.error.set(''); this.notice.set('');
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { this.error.set('En fazla 10 MB boyutunda bir QR görseli seçin.'); field.value = ''; return; }
    this.qrBusy.set(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const text = (await new BrowserQRCodeReader().decodeFromImageUrl(url)).getText();
      if (!text.startsWith('otpauth://totp/')) throw new Error();
      this.input = text; this.notice.set('QR okundu. Kodu üret düğmesine basabilirsiniz.');
    } catch { this.error.set('TOTP QR kodu okunamadı. Daha net bir görsel veya Base32 anahtarı kullanın.'); }
    finally { URL.revokeObjectURL(url); field.value = ''; this.qrBusy.set(false); }
  }
  ngOnDestroy() { clearInterval(this.timer); this.forget(); }
}

