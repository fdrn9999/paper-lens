import type { TranslationErrorCode } from './types';

/** Resolve a TranslationErrorCode to a user-facing message string. */
export function getTranslationErrorMessage(code: TranslationErrorCode, detail?: string): string {
  switch (code) {
    case 'TRANSLATE_QUOTA_EXCEEDED':
      return '오늘의 번역 사용 횟수를 초과했습니다. (일일 50회 제한)';
    case 'RATE_LIMITED':
      return detail || '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    case 'SERVER_ERROR':
      return detail ? `서버 오류 (${detail})` : '서버 오류';
    case 'API_ERROR':
      return detail ? `오류: ${detail}` : 'API 오류';
    case 'TIMEOUT':
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    case 'NETWORK_ERROR':
      return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
    case 'ALREADY_KOREAN':
      return '이미 한국어 텍스트입니다. 영어 텍스트를 선택해주세요.';
    default:
      return '알 수 없는 오류가 발생했습니다.';
  }
}
