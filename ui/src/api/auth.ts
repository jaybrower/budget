import { apiClient } from './client';
import type { LoginRequest, LoginResponse, User } from '../types/auth';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiClient<LoginResponse>('/users/login', {
    method: 'POST',
    body: credentials,
  });
}

export async function getMe(): Promise<User> {
  return apiClient<User>('/users/me');
}
