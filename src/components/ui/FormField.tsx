import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

const controlClassName =
  "block w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

export function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
        {required && (
          <span className="ml-1 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={descriptionId} className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs leading-relaxed text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function FormInput({ className = "", hasError = false, ...props }: FormInputProps) {
  return (
    <input
      {...props}
      aria-invalid={hasError || undefined}
      className={`${controlClassName} ${hasError ? "border-rose-400 focus:border-rose-600 focus:ring-rose-600/10" : ""} ${className}`}
    />
  );
}

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export function FormSelect({ className = "", hasError = false, ...props }: FormSelectProps) {
  return (
    <select
      {...props}
      aria-invalid={hasError || undefined}
      className={`${controlClassName} ${hasError ? "border-rose-400 focus:border-rose-600 focus:ring-rose-600/10" : ""} ${className}`}
    />
  );
}

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export function FormTextarea({ className = "", hasError = false, ...props }: FormTextareaProps) {
  return (
    <textarea
      {...props}
      aria-invalid={hasError || undefined}
      className={`${controlClassName} min-h-24 resize-y ${hasError ? "border-rose-400 focus:border-rose-600 focus:ring-rose-600/10" : ""} ${className}`}
    />
  );
}
