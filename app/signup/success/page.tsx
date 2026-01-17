'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function SignupSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>

          <p className="text-gray-400 mb-6">
            Your account has been created and your subscription is now active.
            Welcome to Bayaan!
          </p>

          <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting to dashboard in {countdown}s...</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Go to Dashboard Now
          </button>

          {sessionId && (
            <p className="mt-4 text-xs text-gray-500">
              Session: {sessionId.substring(0, 20)}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
