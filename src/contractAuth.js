// src/contractAuth.js
import { config } from './config.js';

export function isContractAuthorized(senderId) {
  if (!senderId) return false;
  const id = senderId.toString();
  if (config.bot.ownerIds.includes(id)) return true;
  if (config.contract.allowedIds.includes(id)) return true;
  return false;
}
