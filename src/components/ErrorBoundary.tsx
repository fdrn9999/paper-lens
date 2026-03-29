'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[ErrorBoundary${this.props.section ? `:${this.props.section}` : ''}]`, error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center gap-4" role="alert">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-800">
            {this.props.section
              ? `${this.props.section}에서 오류가 발생했습니다`
              : '오류가 발생했습니다'}
          </h2>
          <p className="text-sm text-gray-500 max-w-md">
            {this.state.error?.message || '예상치 못한 오류가 발생했습니다.'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 transition-colors font-medium"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
