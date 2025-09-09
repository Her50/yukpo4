// src/hooks/useUserSWR.ts
import useSWR from 'swr';
import axios from 'axios';

export function useUserSWR() {
  const { data: user, mutate, isLoading } = useSWR('/user/me', async (url: string) => {
    const token = localStorage.getItem('token');
    const res = await axios.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;
  }, {
    refreshInterval: 60000, // actualisation toutes les 60s
  });
  return { user, mutate, isLoading };
}
