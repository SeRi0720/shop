export const CHAT_PATH = '/api/socket.io';
export const MAX_HTTP_BUFFER_SIZE = 16 * 1024;
export const ROOM_ADMINS = 'admins';
export const customerRoom = (userId: number) => `chat:${userId}`;
