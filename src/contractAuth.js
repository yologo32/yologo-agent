// src/contractAuth.js
import { config } from './config.js';

export function isContractAuthorized(senderId) {
  if (!senderId) return false;
  // CONTRACT_ALLOW_ALL=true => cho phep tat ca user trong group dung /hd
  if (config.contract.allowAll) return true;
  const id = senderId.toString();
  if (config.bot.ownerIds.includes(id)) return true;
  if (config.contract.allowedIds.includes(id)) return true;
  return false;
}
