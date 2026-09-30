import { accessToken, apiBaseUrl, apiRequest, configureApi, type ApiConnection } from '../../../services/api';
import { io } from 'socket.io-client';
import type { FlowerSourceDetail } from './flowerDetailData';

export interface FlowerSession {
  user: { id: string; name?: string; avatar?: string; timezone?: string };
}

export function configureFlowerSession(next: ApiConnection | null): void { configureApi(next); }

export function sourceFlowerImageUri(image: string): string {
  if (/^(https?:|data:)/i.test(image)) return image;
  return `${apiBaseUrl()}/${image.replace(/^\//, '')}`;
}

const request = apiRequest;
export async function loadFlowerSession(): Promise<FlowerSession | null> {
  if (!await accessToken()) return null;
  return request<FlowerSession>('/session');
}

function flowerPath(ownerId: string, flowerId: string): string {
  if (!ownerId || !flowerId) throw new Error('This flower is missing its owner or source identity.');
  return `/users/${encodeURIComponent(ownerId)}/flowers/${encodeURIComponent(flowerId)}`;
}

export function loadFlowerSource(ownerId: string, flowerId: string): Promise<FlowerSourceDetail> {
  return request(flowerPath(ownerId, flowerId));
}

export function giveFlowerSupport(ownerId: string, flowerId: string): Promise<FlowerSourceDetail> {
  return request(`${flowerPath(ownerId, flowerId)}/support`, 'POST');
}

export function leaveFlowerMessage(ownerId: string, flowerId: string, text: string): Promise<FlowerSourceDetail> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length > 300) throw new Error('Messages can contain up to 300 characters.');
  return request(`${flowerPath(ownerId, flowerId)}/message`, 'POST', { text: trimmed });
}

export async function deleteSourceFlower(ownerId: string, flowerId: string): Promise<void> {
  await request(flowerPath(ownerId, flowerId), 'DELETE');
}

export function subscribeToFlowerUpdates(ownerId: string, flowerId: string,
  onUpdate: (flower: FlowerSourceDetail) => void): () => void {
  let cancelled = false;
  let disconnect: (() => void) | undefined;
  accessToken().then((token) => {
    if (cancelled || !token) return;
    const socket = io(apiBaseUrl() || undefined, { auth: (done) => { accessToken().then((fresh) => done({ token: fresh })).catch(() => done({ token: null })); } });
    disconnect = () => socket.disconnect();
    socket.on('connect', () => socket.emit('join-garden', ownerId));
    const update = (payload: { gardenOwnerId?: string; flowerId?: string; flower?: FlowerSourceDetail }) => {
      if (payload?.gardenOwnerId === ownerId && payload.flowerId === flowerId && payload.flower) {
        onUpdate(payload.flower);
      }
    };
    socket.on('supportUpdated', update);
    socket.on('messageAdded', update);
  }).catch(() => { /* Detail requests still report actionable connection errors. */ });
  return () => { cancelled = true; disconnect?.(); };
}
