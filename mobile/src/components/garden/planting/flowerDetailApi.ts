import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import type { FlowerSourceDetail } from './flowerDetailData';

export interface FlowerSession {
  user: { id: string; name?: string; avatar?: string; timezone?: string };
}

interface SessionConnection {
  apiBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
}

let connection: SessionConnection | null = null;

// Native authentication can supply its existing refreshed Firebase token here.
// Web reuses the prototype's existing persisted session token; neither path
// accepts a caller-supplied supporter identity or support day.
export function configureFlowerSession(next: SessionConnection | null): void {
  connection = next;
}

async function storedToken(): Promise<string | null> {
  return typeof window !== 'undefined' && window.localStorage
    ? window.localStorage.getItem('petalPalAccessToken')
    : AsyncStorage.getItem('petalPalAccessToken');
}

function apiBaseUrl(): string {
  if (connection) return connection.apiBaseUrl.replace(/\/$/, '');
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  // The repository's existing development backend listens on port 3000.
  if (typeof window !== 'undefined' && window.location && __DEV__) {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return '';
}

export function sourceFlowerImageUri(image: string): string {
  if (/^(https?:|data:)/i.test(image)) return image;
  return `${apiBaseUrl()}/${image.replace(/^\//, '')}`;
}

async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const token = await (connection ? connection.getAccessToken() : storedToken());
  if (!token) throw new Error('Sign in to PetalPal to interact with other users’ flowers.');
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Unable to load flower details.');
  if (!data) throw new Error('The PetalPal backend did not return flower data.');
  return data as T;
}

export async function loadFlowerSession(): Promise<FlowerSession | null> {
  const token = await (connection ? connection.getAccessToken() : storedToken());
  if (!token) return null;
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
  (connection ? connection.getAccessToken() : storedToken()).then((token) => {
    if (cancelled || !token) return;
    const socket = io(apiBaseUrl() || undefined, { auth: { token } });
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
