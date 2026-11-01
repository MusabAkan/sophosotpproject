export type OtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';
export interface GenerateOtpRequest { secret: string; algorithm: OtpAlgorithm; digits: 6 | 8; period: number; }
export interface GenerateOtpResponse { code: string; serverTime: number; validUntil: number; period: number; }
export interface ApiError { message: string; }
export interface SophosInfo { available: boolean; profiles: string[]; message?: string; }
export interface ConnectVpnRequest { profile: string; username: string; password: string; otp: GenerateOtpRequest; }
export interface ConnectVpnResponse { submitted: true; message: string; }

