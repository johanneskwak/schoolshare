// 브라우저 전용: 사진을 긴 변 1024px, JPEG 0.7로 줄여 Base64로 만든다.
// (LocalStorage 약 5MB 한도를 지키기 위해. 카메라 원본은 3~10MB 이상이다.)
export const MAX_SIDE = 1024;
export const JPEG_QUALITY = 0.7;
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export async function compressImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있습니다.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('이미지가 너무 큽니다 (15MB 이내).');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { dataUrl, base64: dataUrl.split(',')[1], mime: 'image/jpeg' };
}
