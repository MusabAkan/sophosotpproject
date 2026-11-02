import type {ProfileCatalog,ProfileInput,SavedProfile} from '../shared/src';
export interface CryptoProvider {available():Promise<boolean>;encrypt(value:string):Promise<Buffer>;decrypt(value:Buffer):Promise<string|{result:string}>;decryptMany?(values:Buffer[]):Promise<(string|null)[]>;}
export class VaultError extends Error {code:string;}
export class ProfileVault {
  constructor(filename:string,crypto:CryptoProvider,options?:{legacyFiles?:string[];legacyCrypto?:CryptoProvider});
  initialize():Promise<void>;list():Promise<ProfileCatalog>;load(id:string):Promise<SavedProfile>;save(value:ProfileInput):Promise<SavedProfile>;select(id:string|null):Promise<void>;remove(id:string):Promise<void>;close():void;
}
export function createWindowsCrypto():CryptoProvider;
export function dataDirectory():string;
export function openVault(options?:{directory?:string;crypto?:CryptoProvider;legacyFiles?:string[];legacyCrypto?:CryptoProvider}):ProfileVault;
export function validateProfile(value:unknown):ProfileInput;
