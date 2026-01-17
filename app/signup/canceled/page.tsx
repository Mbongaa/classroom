'use client';

import { useRouter } from 'next/navigation';
import { XCircle, ArrowLeft, Mail } from 'lucide-react';

export default function SignupCanceledPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-yellow-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Payment Canceled</h1>

          <p className="text-gray-400 mb-6">
            Your payment was not completed. Your account has been created but is
            not yet active. You can complete the payment to activate your subscription.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/signup')}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Try Again
            </button>

            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-sm text-gray-500 mb-3">Need help?</p>
            <a
              href="mailto:support@bayaan.app"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              <Mail className="h-4 w-4" />
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
