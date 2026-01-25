'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signUp } from '@/lib/actions/auth';
import { Button } from '@/components/ui/moving-border';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { Check } from 'lucide-react';

type PlanType = 'pro' | 'beta';

interface PlanOption {
  id: PlanType;
  name: string;
  price: string;
  description: string;
  features: string[];
  badge?: string;
}

const BETA_PLAN: PlanOption = {
  id: 'beta',
  name: 'Beta',
  price: 'Free',
  description: 'Early access during beta period',
  badge: 'Recommended',
  features: [
    'Unlimited classrooms',
    'Real-time translation',
    'Recording & transcription',
    'Up to 100 participants',
    'No credit card required',
  ],
};

const PRO_PLAN: PlanOption = {
  id: 'pro',
  name: 'Pro',
  price: '€199.99/month',
  description: 'Full access with premium support',
  features: [
    'Unlimited classrooms',
    'Real-time translation',
    'Recording & transcription',
    'Up to 100 participants',
    'Priority support',
  ],
};

function SubmitButton({
  isFormValid,
  isSubmitting,
  selectedPlan,
}: {
  isFormValid: boolean;
  isSubmitting: boolean;
  selectedPlan: PlanType;
}) {
  const { pending } = useFormStatus();
  const isDisabled = !isFormValid || pending || isSubmitting;
  const buttonText =
    pending || isSubmitting
      ? 'Creating account...'
      : selectedPlan === 'beta'
        ? 'Create Account'
        : 'Continue to Payment';

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
      {buttonText}
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
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('beta');

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

      // Handle redirect based on plan type
      if (result.redirectUrl) {
        // Beta plan - redirect to dashboard
        window.location.href = result.redirectUrl;
      } else if (result.checkoutUrl) {
        // Pro plan - redirect to Stripe Checkout
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
              Choose Your Plan
            </span>
            <div className="w-full border-t border-[#4b5563]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Beta Plan */}
            <button
              type="button"
              onClick={() => setSelectedPlan('beta')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedPlan === 'beta'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-gray-600 bg-transparent hover:border-gray-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-white">{BETA_PLAN.name}</h3>
                  {BETA_PLAN.badge && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded">
                      {BETA_PLAN.badge}
                    </span>
                  )}
                </div>
                <span className="text-lg font-bold text-green-400">{BETA_PLAN.price}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{BETA_PLAN.description}</p>
              <ul className="space-y-1">
                {BETA_PLAN.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>

            {/* Pro Plan */}
            <button
              type="button"
              onClick={() => setSelectedPlan('pro')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedPlan === 'pro'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 bg-transparent hover:border-gray-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-white">{PRO_PLAN.name}</h3>
                </div>
                <span className="text-lg font-bold text-blue-400">{PRO_PLAN.price}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{PRO_PLAN.description}</p>
              <ul className="space-y-1">
                {PRO_PLAN.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Check className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          </div>

          <input type="hidden" name="plan" value={selectedPlan} />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <SubmitButton isFormValid={isFormValid} isSubmitting={isSubmitting} selectedPlan={selectedPlan} />

          <p className="text-xs text-center text-gray-500">
            {selectedPlan === 'beta'
              ? 'Start using Bayaan immediately - no payment required during beta.'
              : "You'll be redirected to Stripe to complete payment securely."}
          </p>
        </div>
      </form>
    </div>
  );
}
