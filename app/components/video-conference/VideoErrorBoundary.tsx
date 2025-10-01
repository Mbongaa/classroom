'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class VideoErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('VideoErrorBoundary caught an error:', error, errorInfo);
    }

    // You could also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when there's an error
      return (
        <div
          className="flex flex-col items-center justify-center h-full w-full p-4"
          style={{
            backgroundColor: 'var(--lk-bg3)',
            color: 'var(--lk-text1, white)',
          }}
        >
          <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--lk-text1, white)' }}>
            Video Component Error
          </h2>
          <p className="text-sm text-center max-w-md" style={{ color: 'var(--lk-text2, #6b7280)' }}>
            {this.props.fallbackMessage ||
              'Something went wrong displaying this video. Please try refreshing the page or check your connection.'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details
              className="mt-4 text-xs max-w-md"
              style={{ color: 'var(--lk-text2, #6b7280)' }}
            >
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
