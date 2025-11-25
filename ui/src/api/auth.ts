import { apiClient } from './client';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from '../types/auth';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiClient<LoginResponse>('/users/login', {
    method: 'POST',
    body: credentials,
  });
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  return apiClient<RegisterResponse>('/users/register', {
    method: 'POST',
    body: data,
  });
}

export async function getMe(): Promise<User> {
  return apiClient<User>('/users/me');
}
