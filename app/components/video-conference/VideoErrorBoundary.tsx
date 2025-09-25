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
        <div className="flex flex-col items-center justify-center h-full w-full bg-gray-900 text-white p-4">
          <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
          <h2 className="text-lg font-semibold mb-2">Video Component Error</h2>
          <p className="text-sm text-gray-400 text-center max-w-md">
            {this.props.fallbackMessage ||
             'Something went wrong displaying this video. Please try refreshing the page or check your connection.'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-xs text-gray-500 max-w-md">
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