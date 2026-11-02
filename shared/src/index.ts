export type OtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';
export interface GenerateOtpRequest { secret: string; algorithm: OtpAlgorithm; digits: 6 | 8; period: number; }
export interface GenerateOtpResponse { code: string; serverTime: number; validUntil: number; period: number; }
export interface ApiError { message: string; }
export interface SophosInfo { available: boolean; profiles: string[]; message?: string; }
export interface ConnectVpnRequest { profile: string; username: string; password: string; otp: GenerateOtpRequest; }
export interface ConnectVpnResponse { submitted: true; message: string; }


export type AppLanguage = 'tr' | 'en' | 'de' | 'fr' | 'es';
export interface ProfileInput { version: 2; id?: string; revision?: number; name: string; provider: 'sophos'; language: AppLanguage; profile: string; username: string; password: string; otp: GenerateOtpRequest | null; }
export interface SavedProfile extends ProfileInput { id: string; revision: number; }
export interface ProfileSummary { id: string; name: string; provider: 'sophos'; updatedAt: string; readable: boolean; }
export interface ProfileCatalog { profiles: ProfileSummary[]; selectedId: string | null; legacyPending: boolean; }
export interface DesktopBridge { session(): Promise<{token: string}>; }
declare global { interface Window { sophosDesktop?: DesktopBridge; } }
