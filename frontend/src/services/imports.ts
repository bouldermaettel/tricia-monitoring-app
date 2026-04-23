import { apiClient } from './api';

export async function uploadImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/imports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
