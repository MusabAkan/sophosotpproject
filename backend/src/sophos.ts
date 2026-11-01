import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ConnectVpnRequest, ConnectVpnResponse, SophosInfo } from '../../shared/src';
import { generateOtp } from './otp';

export type CliRunner = (file: string, args: string[]) => Promise<string>;
const runCli: CliRunner = (file, args) => new Promise((resolve, reject) => {
  execFile(file, args, { windowsHide: true, shell: false, timeout: 20000, maxBuffer: 128 * 1024 }, (error, stdout) => {
    // Never expose the child-process error: it can contain the password arguments.
    if (error) reject(new Error('Sophos işlemi tamamlanamadı.'));
    else resolve(stdout);
  });
});

export function parseProfiles(output: string): string[] {
  const lines = output.split(/\r?\n/);
  const header = lines.findIndex(line => line.trim() === 'Connections:');
  if (header < 0) return [];
  return [...new Set(lines.slice(header + 1).filter(line => /^\s{2}\S/.test(line)).map(line => line.trim()))];
}

export class SophosService {
  private connecting = false;
  private readonly executable: string | undefined;
  constructor(private readonly run: CliRunner = runCli, executable?: string, private readonly now = Date.now) {
    this.executable = executable ?? [
      'C:\\Program Files (x86)\\Sophos\\Connect\\sccli.exe',
      'C:\\Program Files\\Sophos\\Connect\\sccli.exe',
    ].find(file => existsSync(file));
  }
  async info(): Promise<SophosInfo> {
    if (!this.executable) return { available: false, profiles: [], message: 'Sophos Connect komut aracı bulunamadı. Elle giriş için kopyalama düğmelerini kullanabilirsin.' };
    try {
      const profiles = parseProfiles(await this.run(this.executable, ['list']));
      return { available: true, profiles, ...(profiles.length ? {} : { message: 'Sophos Connect’te kayıtlı bir bağlantı bulunamadı.' }) };
    } catch { return { available: false, profiles: [], message: 'Sophos Connect bağlantıları okunamadı. Sophos servisinin çalıştığını kontrol et.' }; }
  }
  async connect(body: ConnectVpnRequest): Promise<ConnectVpnResponse> {
    if (this.connecting) throw new Error('Bir bağlantı isteği zaten sürüyor.');
    if (!body || typeof body.profile !== 'string' || !body.profile.trim() || body.profile.length > 256
        || typeof body.username !== 'string' || !body.username.trim() || body.username.length > 256
        || typeof body.password !== 'string' || !body.password || body.password.length > 1024
        || /[\0\r\n]/.test(body.profile + body.username + body.password))
      throw new Error('Bağlantı, kullanıcı adı ve mevcut şifre alanlarını doldur.');
    // Validate OTP settings before invoking any executable.
    generateOtp(body.otp, this.now());
    this.connecting = true;
    try {
      const info = await this.info();
      if (!info.available) throw new Error(info.message);
      if (!info.profiles.includes(body.profile)) throw new Error('Seçilen bağlantı Sophos Connect’te bulunamadı. Listeyi yenile.');
      // Generate after the read-only profile lookup, immediately before handing off.
      const otp = generateOtp(body.otp, this.now());
      if (otp.validUntil - otp.serverTime < 5000)
        throw new Error('Kodun süresi bitmek üzere. Yeni kodu bekleyip tekrar bağlan.');
      try {
        await this.run(this.executable!, ['enable', '-n', body.profile, '-u', body.username, '-p', body.password + otp.code]);
      } catch { throw new Error('Sophos bağlantı isteğini kabul etmedi. Profil, giriş bilgileri ve Sophos Connect olaylarını kontrol et.'); }
      return { submitted: true, message: 'Bağlantı isteği Sophos’a gönderildi. Bağlantı durumunu Sophos Connect’ten kontrol et.' };
    } finally { this.connecting = false; }
  }
}
