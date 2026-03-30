'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import useStore from '@/store/useStore';
import QuotaIndicator from '@/components/QuotaIndicator';

const EXAMPLE_QUESTIONS = [
  '핵심 연구 방법은?',
  '주요 결론은?',
  '한계점은?',
];

const MAX_CHARS = 2000;

/** Simple markdown-like formatting: bold, line breaks, bullet lists */
function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const formatted = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        });

        // Bullet list
        if (line.match(/^[-•]\s/)) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-gray-400 shrink-0">•</span>
              <span>{formatted.slice(0).map((f, fi) => {
                if (fi === 0 && typeof f === 'object' && f !== null && 'props' in f) {
                  const el = f as React.ReactElement<{ children?: string }>;
                  return <span key={fi}>{React.cloneElement(el, {}, String(el.props.children ?? '').replace(/^[-•]\s/, ''))}</span>;
                }
                return <span key={fi}>{f}</span>;
              })}</span>
            </div>
          );
        }

        // Numbered list
        if (line.match(/^\d+\.\s/)) {
          return <div key={i} className="pl-1">{formatted}</div>;
        }

        // Heading-like (starts with #)
        if (line.match(/^#{1,3}\s/)) {
          const clean = line.replace(/^#{1,3}\s/, '');
          return <div key={i} className="font-semibold text-gray-900 mt-1">{clean}</div>;
        }

        // Empty line
        if (line.trim() === '') {
          return <div key={i} className="h-1" />;
        }

        return <div key={i}>{formatted}</div>;
      })}
    </div>
  );
}

/** Typing indicator with 3 bouncing dots */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export default memo(function ChatPanel() {
  const pdfData = useStore((s) => s.pdfData);
  const isExtracting = useStore((s) => s.isExtracting);
  const pageTextContents = useStore((s) => s.pageTextContents);
  const chatMessages = useStore((s) => s.chatMessages);
  const isChatLoading = useStore((s) => s.isChatLoading);
  const chatSummary = useStore((s) => s.chatSummary);
  const isSummarizing = useStore((s) => s.isSummarizing);
  const chatQuota = useStore((s) => s.chatQuota);
  const sendChatMessage = useStore((s) => s.sendChatMessage);
  const summarizePaper = useStore((s) => s.summarizePaper);
  const clearChat = useStore((s) => s.clearChat);

  const [input, setInput] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSummarizedRef = useRef(false);

  // Reset summarize flag when PDF changes
  useEffect(() => {
    if (!pdfData) {
      hasSummarizedRef.current = false;
    }
  }, [pdfData]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isChatLoading || isExtracting) return;
    sendChatMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isChatLoading, isExtracting, sendChatMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleExampleClick = useCallback((question: string) => {
    sendChatMessage(question);
  }, [sendChatMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setInput(value);
    }
  }, []);

  // No PDF loaded
  if (!pdfData) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-400 text-center">
          PDF를 업로드하면 AI 분석을<br />사용할 수 있습니다.
        </p>
      </div>
    );
  }

  // Extracting text
  if (isExtracting && pageTextContents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        <p className="text-sm text-blue-600 font-medium">텍스트 추출 중...</p>
        <p className="text-xs text-gray-400">완료 후 AI 분석이 가능합니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-gray-50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 shrink-0">AI 분석</h3>
          {chatQuota && (
            <QuotaIndicator
              label="AI"
              usedPercent={chatQuota.usedPercent}
              color="purple"
              compact
            />
          )}
        </div>
        <button
          onClick={() => {
            if (confirmClear) {
              clearChat();
              setConfirmClear(false);
              if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
            } else {
              setConfirmClear(true);
              confirmClearTimerRef.current = setTimeout(() => setConfirmClear(false), 3000);
            }
          }}
          className={`p-1.5 rounded-md transition-colors shrink-0 min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 flex items-center justify-center gap-1 ${
            confirmClear
              ? 'text-red-600 bg-red-50 hover:bg-red-100'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}
          aria-label="대화 초기화"
          title="대화 초기화"
        >
          {confirmClear ? (
            <span className="text-xs font-medium">초기화?</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Paper Summary Section */}
        {(isSummarizing || chatSummary) && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 overflow-hidden">
            <button
              onClick={() => setSummaryExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left min-h-[44px]"
            >
              <span className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                논문 요약
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-purple-400 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {summaryExpanded && (
              <div className="px-3 pb-3">
                {isSummarizing ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                    <span className="text-xs text-purple-600">요약 생성 중...</span>
                  </div>
                ) : chatSummary ? (
                  <div className="text-gray-700">
                    <FormattedText text={chatSummary} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Chat Messages */}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              ) : (
                <div className="chat-message">
                  <FormattedText text={msg.content} />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      window.dispatchEvent(new CustomEvent('paperlens-toast', { detail: { text: '복사되었습니다.', type: 'success' } }));
                    }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="복사"
                    aria-label="메시지 복사"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm shadow-sm">
              <TypingIndicator />
            </div>
          </div>
        )}

        {/* Empty state: no messages yet */}
        {chatMessages.length === 0 && !isChatLoading && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-gray-400 mb-4">
              논문에 대해 궁금한 것을 질문해보세요.
            </p>
            {!chatSummary && !isSummarizing && (
              <button
                onClick={summarizePaper}
                className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors text-left mb-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-700">논문 요약 생성하기</p>
                    <p className="text-xs text-purple-500">AI가 논문의 핵심 내용을 구조화하여 요약합니다</p>
                  </div>
                </div>
              </button>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExampleClick(q)}
                  disabled={isChatLoading || isExtracting}
                  className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t bg-white p-2.5">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isChatLoading || isExtracting}
              placeholder="논문에 대해 질문하세요..."
              rows={1}
              className="w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ maxHeight: 120 }}
            />
            {input.length > 0 && (
              <span className={`absolute right-2 bottom-1 text-[10px] tabular-nums ${input.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
                {input.length}/{MAX_CHARS}
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading || isExtracting}
            className="shrink-0 p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="전송"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});
