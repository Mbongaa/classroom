'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signUp } from '@/lib/actions/auth';
import { Button } from '@/components/ui/moving-border';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { Check } from 'lucide-react';

type PlanType = 'pro' | 'enterprise';

interface PlanOption {
  id: PlanType;
  name: string;
  price: string;
  description: string;
  features: string[];
}

const PLANS: PlanOption[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$49/month',
    description: 'Perfect for small to medium organizations',
    features: [
      'Unlimited classrooms',
      'Real-time translation',
      'Recording & transcription',
      'Up to 100 participants',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$199/month',
    description: 'For large organizations with advanced needs',
    features: [
      'Everything in Pro',
      'Unlimited participants',
      'Priority support',
      'Custom branding',
      'Advanced analytics',
    ],
  },
];

function SubmitButton({ isFormValid, isSubmitting }: { isFormValid: boolean; isSubmitting: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = !isFormValid || pending || isSubmitting;
  return (
    <Button
      as="button"
      type="submit"
      disabled={isDisabled}
      borderRadius="1.75rem"
      containerClassName="w-full h-12"
      className={
        !isDisabled
          ? 'bg-[#f1f2f4] dark:bg-[#111418] text-gray-900 dark:text-white border-[#4b5563] text-lg font-medium'
          : 'bg-transparent text-gray-900 dark:text-white border-[#4b5563] text-lg font-medium'
      }
      duration={3000}
    >
      {pending || isSubmitting ? 'Creating account...' : 'Continue to Payment'}
    </Button>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('pro');

  // Field-specific validation errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Track which fields have been touched
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return '';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return '';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  // Calculate if form is valid (all required fields filled AND no errors)
  const isFormValid =
    fullName.trim() !== '' &&
    email.trim() !== '' &&
    password.length >= 8 &&
    orgName.trim() !== '' &&
    orgSlug.trim() !== '' &&
    !emailError &&
    !passwordError;

  function handleOrgNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setOrgName(name);
    setOrgSlug(slugify(name));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    // Add the selected plan to form data
    formData.append('plan', selectedPlan);

    try {
      const result = await signUp(formData);

      if (!result.success && result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      // If successful, redirect to Stripe Checkout
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form action={handleSubmit}>
        <div className="grid gap-4">
          <FloatingLabelInput
            id="fullName"
            name="fullName"
            label="Full Name"
            type="text"
            autoCapitalize="words"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <div className="grid gap-2">
            <FloatingLabelInput
              id="email"
              name="email"
              label="Email"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) {
                  setEmailError(validateEmail(e.target.value));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, email: true }));
                setEmailError(validateEmail(email));
              }}
              required
            />
            {touched.email && emailError && (
              <p className="text-xs text-red-600 dark:text-red-400">{emailError}</p>
            )}
          </div>
          <div className="grid gap-2">
            <FloatingLabelInput
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) {
                  setPasswordError(validatePassword(e.target.value));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, password: true }));
                setPasswordError(validatePassword(password));
              }}
              required
              minLength={8}
            />
            {touched.password && passwordError ? (
              <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Must be at least 8 characters
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase text-gray-600 dark:text-gray-400">
              Organization Details
            </span>
            <div className="w-full border-t border-[#4b5563]" />
          </div>

          <div className="grid gap-2">
            <FloatingLabelInput
              id="orgName"
              name="orgName"
              label="Organization Name"
              type="text"
              value={orgName}
              onChange={handleOrgNameChange}
              required
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Your school, company, or organization name
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">bayaan.app/</span>
              <FloatingLabelInput
                id="orgSlug"
                name="orgSlug"
                label="URL Slug"
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(slugify(e.target.value))}
                required
                className="flex-1"
                // No pattern attribute - slugify handles validation
              />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 mt-2">
            <span className="text-xs uppercase text-gray-600 dark:text-gray-400">
              Select Your Plan
            </span>
            <div className="w-full border-t border-[#4b5563]" />
          </div>

          <div className="grid gap-3">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedPlan === plan.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    <p className="text-sm text-gray-400">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{plan.price}</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-400">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {selectedPlan === plan.id && (
                  <div className="absolute top-3 right-3">
                    <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          <input type="hidden" name="plan" value={selectedPlan} />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <SubmitButton isFormValid={isFormValid} isSubmitting={isSubmitting} />

          <p className="text-xs text-center text-gray-500">
            You&apos;ll be redirected to Stripe to complete payment securely.
          </p>
        </div>
      </form>
    </div>
  );
}
