import type { EmbeddingProgress, TranslationErrorCode } from './types';

/** Resolve an EmbeddingProgress status to a user-facing message string. */
export function getEmbeddingMessage(progress: EmbeddingProgress | null): string {
  if (!progress) return '';
  switch (progress.code) {
    case 'WAIT_EXTRACTION':
      if (progress.current != null && progress.total && progress.total > 0) {
        return `텍스트 추출 중... (${progress.current}/${progress.total} 페이지) 완료 후 검색됩니다.`;
      }
      return '텍스트 추출 완료 후 검색 가능합니다.';
    case 'EMBED_QUOTA_EXCEEDED':
      return '오늘의 AI 검색 사용 횟수를 초과했습니다. (일일 20회 제한)';
    case 'RATE_LIMITED':
      return progress.detail || '일일 사용 한도를 초과했습니다.';
    case 'ANALYZING':
      return `문서 분석 중... (${progress.current ?? '?'}/${progress.total ?? '?'})`;
    case 'COMPARING_KEYWORD':
      return '키워드 비교 중...';
    case 'NO_RESULTS':
      return '관련 결과 없음';
    case 'FALLBACK_RESULTS':
      return '유사한 결과를 표시합니다 (정확도 낮음)';
    case 'TIMEOUT':
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    case 'NETWORK_ERROR':
      return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
    case 'API_ERROR':
      return progress.detail ? `API 오류 (${progress.detail})` : 'API 오류';
    case 'EMBED_FAILED':
      return progress.detail ? `오류: ${progress.detail}` : '키워드 임베딩 실패';
    default:
      return '';
  }
}

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
